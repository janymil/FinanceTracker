"""Rough count of hardcoded English UI text (outside t(...)), for the readiness report.

    python3 scripts/count-hardcoded-text.py

Prints the number of candidate lines and the files they cluster in. It is a measuring tool, not a
gate: a real gate would need to know which strings are already covered by the translation files.
"""
import pathlib
import re

text_node = re.compile(r">\s*([A-Z][a-z]+(?:\s+[A-Za-z,\-']+){2,})\s*<")
attr_text = re.compile(
    r"""(?:placeholder|title|aria-label)="([A-Z][a-z]+(?:\s+[A-Za-z,\-'"]+){2,})\""""
)
hits = []
for path in pathlib.Path("client/src").rglob("*.tsx"):
    for number, line in enumerate(path.read_text(encoding="utf-8").split("\n"), 1):
        if "t(" in line:
            continue
        if text_node.search(line) or attr_text.search(line):
            hits.append((str(path), number, line.strip()[:90]))

print("candidate hardcoded English lines:", len(hits))
counts = {}
for path, _, _ in hits:
    counts[path] = counts.get(path, 0) + 1
for path, count in sorted(counts.items(), key=lambda item: -item[1])[:10]:
    print(f"{count:4d}  {path}")
