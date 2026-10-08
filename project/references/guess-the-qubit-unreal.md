# Guess the Qubit — inspected Unreal reference

## Evidence and scope
Read-only inspection of the running UE 5.8 project GuessTheQubit through its MCP server on localhost:8000 confirmed Main_Level, /Game/Blueprints/BP_Qubit, GM_Main and WBP_MainMenu. No play session, API request or hardware job was triggered during inspection. The desktop MCP endpoint is not the Quantum service URL.

## Gameplay
- Guess 0 or 1 in either Simulator or Hardware Jobs.
- Begin with the vector at |0>. Rotate by pi/2 to the equator.
- Wait until both the intro animation and a validated measurement are ready.
- Collapse to the corresponding pole, then compare the measurement with the stored guess.
- Show You Won or You Lost; Reset clears the round. No numeric score exists in the inspected game.
- Home replaces desktop Quit in the phone adaptation. Keep the AR camera user-controlled.

## Geometry and appearance
The live sphere uses a translucent cyan shell with three axis rings and X/Y/Z labels, plus |0>, |1>, |+>, |->, |+i>, |−i> labels. The state point, vector shaft and tip use magenta. Rebuild with Viro primitives at about 0.25m globe diameter; map Unreal Z-up to Viro Y-up.

Verified material linear-RGB tint defaults: cyan (0, 0.78, 1), shell (0, 0.62, 0.78), magenta (1, 0.03, 0.63). Preserve relative proportions and calibrate glow/transparency on the physical device. HUD controls are dark with mint borders; mobile layout uses safe areas rather than copying desktop canvas offsets.

## Runtime contract
Production v1 base: https://davidjgrimsley.com/public-facing/api/quantum/v1
Auth: supplied development X-API-Key, held privately on device.

Simulator: POST /gates/run with gate_type rotation and rotation_angle_rad Math.PI / 2. Use measurement, not response.success, to compare the user's guess.

Hardware: POST /jobs/circuits with provider ibm, shots 1, and circuit { num_qubits: 1, operations: [{ gate: ry, target: 0, theta: Math.PI / 2 }] }. The inspected defaults are backend_name ibm_kingston and existing profile Unreal Engine Demos; check runtime availability and keep configuration editable without credential administration.

Poll GET /jobs/{job_id} every 15 seconds. On succeeded, fetch GET /jobs/{job_id}/result and validate one-shot counts for 0 or 1. Handle queued/running/cancelling/failed/cancelled explicitly. POST /jobs/{job_id}/cancel attempts cancellation.

## Mobile reliability requirements
Block another guess while a round is active. Bind callbacks to a round identity so late results cannot affect a reset/new round. Stop polls and abort local requests on teardown. If a submission returns its job ID after Reset/Home, attempt cancellation without accepting its result. Do not automatically resubmit a hardware job after a timeout.

The Unreal graph quits after some hardware failures and does not cover every polling/callback error. Preserve its intended game mechanics while providing recoverable phone UX. A submission acknowledgement is not proof of hardware execution.

## Acceptance scenarios
Test both guesses against both measurements, fast and slow responses relative to the intro, invalid measurement/counts, denied credentials, rate limiting, offline requests, queued/running/succeeded/failed/cancelled jobs, Reset/Home during submission or polling, duplicate taps and late responses. Complete physical iPhone AR testing before claiming the scene works; Android follows.
