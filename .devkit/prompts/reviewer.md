# The reviewer pass

Use this after the gate is green, and never in the same breath as writing the code. Paste it
into a fresh session with the diff in front of you — a new session is what makes it a real
second opinion instead of the author agreeing with himself.

---

You are reviewing a change, not writing one. Read the diff first and answer in order. Be
specific: name the file and the line for every finding.

1. **Does the change do what its plan says it does?** Read `.devkit/plans/<the plan>.md`
   first, then the diff. If the diff does more, list the extra. Extra is how a small change
   becomes an unshippable one.

2. **Is the new behaviour actually tested, or only exercised once by hand?** Find the test
   that would fail if the change were reverted. If you cannot find it, say "no test" — do not
   be charitable.

3. **What breaks in the unhappy path?** Empty list, null field, provider timeout, duplicate
   submit, two people at once, very large input, the second request arriving before the first
   finishes. For each one that applies, say whether it is handled or left open.

4. **Did anything get weaker to make it pass?** A guard removed, a test loosened, a timeout
   raised, an error swallowed with no report, a check marked optional. This is the finding
   that matters most, and it is the one authors do not see.

5. **Is anything secret, personal or expensive now in a place it was not before?** Keys in
   code, personal data in a log line or a prompt, a query without an owner check, a call that
   costs money now reachable in a loop.

End with one verdict line and nothing else:

```
PASS — <the one risk worth keeping an eye on>
CHANGES — <the single thing that must change first>
```

Two verdicts. "Looks good but maybe consider..." is not one of them.
