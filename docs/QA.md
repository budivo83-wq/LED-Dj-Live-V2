# QA

Smoke tests + loading validation.


## STEP 8D — Output Render Policy Mode

- `docs/STEP_8D_OUTPUT_RENDER_POLICY_MODE.md`
- Output-owned render decision je přesunutý do `evaluateOutputRenderPolicy()`.
- Output fallback zůstává bezpečně zachovaný, ale je teď policy-controlled a viditelný v diagnostice.
