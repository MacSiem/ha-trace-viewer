#!/usr/bin/env python3
"""Standalone, non-gating HA frontend review hints (Python standard library).

Pass explicit canonical JS/TS sources, not their generated bundles. Identical
mirrors are deduplicated. CI integrations should use continue-on-error: true.
Findings exit zero and do not assert a defect: reviewers must check the producer
contract, any guard outside the local expression, and whether zero is legal.
This lexical heuristic is not a JavaScript parser or a security audit. It never
executes sources and reports locations rather than source text or data values.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re


IDENT = r"[A-Za-z_$][\w$]*"
NUMBER = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?"
OBJECT = re.compile(rf"(?<![\w$.])((?:this\s*\.\s*)?{IDENT})\s*=\s*\{{")
CONSTANT = re.compile(rf"\b(?:const|let|var)\s+([A-Z][A-Z0-9_]*)\s*=\s*({NUMBER})\b")
FALLBACK = re.compile(
    rf"\b(?:this\s*\.\s*)?(?:_?config|options)"
    rf"(?:\s*(?:\??\.\s*{IDENT}|\[[^\]\n]*\]))+"
    rf"\s*(?:,\s*\d+\s*)?\)*\s*\|\|\s*({NUMBER}|[A-Z][A-Z0-9_]*)\b")
IGNORED_PARTS = {'node_modules', 'vendor', 'tests', 'test', '__tests__'}
EXTENSIONS = {'.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'}


def code_only(source):
    """Keep offsets/newlines and code inside template interpolations."""
    output = list(source)
    stack = [('code', 0)]
    i = 0

    def blank(start, end):
        for index in range(start, end):
            if source[index] not in '\r\n':
                output[index] = ' '

    while i < len(source):
        mode, depth = stack[-1]
        char = source[i]
        if mode == 'template':
            if char == '\\':
                end = min(i + 2, len(source))
                blank(i, end)
                i = end
            elif source.startswith('${', i):
                blank(i, i + 2)
                stack.append(('expression', 1))
                i += 2
            elif char == '`':
                blank(i, i + 1)
                stack.pop()
                i += 1
            else:
                blank(i, i + 1)
                i += 1
            continue
        if source.startswith('//', i):
            end = source.find('\n', i)
            end = len(source) if end < 0 else end
            blank(i, end)
            i = end
        elif source.startswith('/*', i):
            end = source.find('*/', i + 2)
            end = len(source) if end < 0 else end + 2
            blank(i, end)
            i = end
        elif char in "\"'":
            end = i + 1
            while end < len(source):
                if source[end] == '\\':
                    end += 2
                elif source[end] == char:
                    end += 1
                    break
                else:
                    end += 1
            end = min(end, len(source))
            blank(i, end)
            i = end
        elif char == '`':
            blank(i, i + 1)
            stack.append(('template', 0))
            i += 1
        else:
            if mode == 'expression' and char in '{}':
                depth += 1 if char == '{' else -1
                if depth == 0:
                    blank(i, i + 1)
                    stack.pop()
                else:
                    stack[-1] = (mode, depth)
            i += 1
    return ''.join(output)


def scan_text(source, filename):
    code = code_only(source)
    findings = {}

    def add(rule, offset, message):
        line = code.count('\n', 0, offset) + 1
        findings[(line, rule)] = dict(file=filename, line=line, rule=rule,
                                     message=message)

    for name in set(OBJECT.findall(code)):
        reference = re.sub(r'\s+', '', name)
        lookup = re.compile(rf"(?<![\w$]){re.escape(name)}\s*\[([^\]\n]+)\]")
        for match in lookup.finditer(code):
            key = re.sub(r'\s+', '', match[1])
            if not key or re.fullmatch(NUMBER, key):
                continue  # Literal/quoted keys are not producer-selected keys.
            prefix = re.sub(r'\s+', '', code[:match.start()])
            guards = [f'Object.hasOwn({reference},{key})',
                      f'Object.prototype.hasOwnProperty.call({reference},{key})']
            # Only suppress a direct positive ternary condition. Nearby checks,
            # negation and compound conditions do not prove lookup protection.
            if any(re.search(r'(?:^|[=(:,])' + re.escape(guard) + r'\?$', prefix)
                   for guard in guards):
                continue
            add('HA-A01', match.start(),
                'Review dynamic object lookup: verify HA key domain and own-property protection.')

    constants = {name: float(number) for name, number in CONSTANT.findall(code)}
    for match in FALLBACK.finditer(code):
        fallback = match[1]
        value = (float(fallback) if re.fullmatch(NUMBER, fallback)
                 else constants.get(fallback))
        if value is None or value == 0:
            continue
        add('HA-B01', match.start(),
            'Review numeric configuration fallback: establish whether zero is valid before changing ||.')
    return [findings[key] for key in sorted(findings)]


def scan_files(root, paths):
    root = root.resolve()
    result = dict(status='advisory', scanned_files=0, duplicate_files=0,
                  ignored_files=0, findings=[])
    seen = set()
    for name in paths:
        path = (root / name).resolve()
        if not path.is_relative_to(root):
            raise ValueError('source_path_outside_root')
        relative = path.relative_to(root)
        if (IGNORED_PARTS.intersection(relative.parts)
                or path.name.endswith(('.min.js', '.test.js', '.spec.js'))
                or path.name == 'chart-vendor.js'):
            result['ignored_files'] += 1
            continue
        if path.suffix not in EXTENSIONS or not path.is_file():
            raise ValueError('invalid_source_file')
        data = path.read_bytes()
        digest = hashlib.sha256(data).digest()
        if digest in seen:
            result['duplicate_files'] += 1
            continue
        seen.add(digest)
        result['scanned_files'] += 1
        result['findings'].extend(scan_text(data.decode('utf-8'), relative.as_posix()))
    result['findings'].sort(key=lambda item: (item['file'], item['line'], item['rule']))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path.cwd())
    parser.add_argument('paths', nargs='+')
    args = parser.parse_args()
    try:
        result = scan_files(args.root, args.paths)
    except (OSError, UnicodeError, ValueError, RuntimeError) as error:
        reason = str(error) if isinstance(error, ValueError) else 'source_read_failed'
        print(json.dumps(dict(status='invalid_input', reason=reason)))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
