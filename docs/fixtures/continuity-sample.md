# Continuity fixture (human-readable)

Used by fixture extractor / manual QA when `LLM_API_KEY` is unset.

## Bible (seed)

**Character — Aria**

- fact: `eye_color` = `amber` · statement: `eye color: amber`

## Chapter body

```
Aria looked up, her blue eyes wide. Kael drew his sword beside her.
```

## Expected gates

| Claim (conceptual) | Result |
|--------------------|--------|
| Aria eye_color blue | **red** mark near `blue eyes` |
| Kael exists / wields sword | **proposal** new character (high conf) if unknown |

Wire tests to structured claims equivalent to the above, not to flaky live LLM.
