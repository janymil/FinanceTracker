# Definition of done

A change is done when all five are true. "Mostly" is not done, and neither is "the tests
passed when I ran them earlier".

1. **One sentence the owner can read.** What is different for the person using this, in
   plain words, with no code names in it? If the honest sentence needs a file name, write
   that part in the technical note instead.

2. **A test that fails without the change.** Name the file and the case. If reverting the
   change leaves every test green, there is no test — there is a wish.

3. **The gate passes, in this session.** `./verify.sh` exits 0. Not a remembered pass, not
   a partial command that looks like the gate.

4. **The risk is named.** What breaks if this is wrong · who notices · how fast. "Nothing
   can go wrong" is always the wrong answer; if it were free, it is not worth naming, but
   a change with no risk at all is rare enough to be suspicious.

5. **A second pass happened.** Someone read the diff who did not write it, using the five
   questions above. In practice this is you, after a break, reading it as a reviewer —
   see `.devkit/prompts/reviewer.md`. The author and the reviewer must not be the same
   pass, or the gate is theatre.

---

## When one of the five cannot be answered

Say so in the report, in one line, and say why. A known gap that is written down is worth
more than a clean claim that someone later has to discover is false.

- No test possible (a visual change, a third-party outage)? → name the manual check instead,
  and say who did it.
- Gate failing for a reason that predates the change? → say which step, and quote the error.
- Not sure about the risk? → that is the answer: "not sure what happens if X" is a real risk.

## The report, at the end

Four lines, no more:

```
Changed:  <the plain sentence from Q1>
Proved:   <verify.sh result> · <test file> (or: manual check, by whom)
Risk:     <Q4>
Not done: <the honest gap, or "none">
```
