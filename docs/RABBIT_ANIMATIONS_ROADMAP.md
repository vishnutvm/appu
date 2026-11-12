# Rabbit Companion — Animation Library & Gemini Prompt Roadmap

This document tracks the **Rabbit** video companion assets currently integrated in Appu and stores the **46 pending animations** with ready-to-paste Gemini video-generation prompts for when your generation quota resets.

---

## 1. Completed & Live Right Now (Wrapped POC)

| Key | File | Mode | Notes |
| :--- | :--- | :--- | :--- |
| Reference | `public/characters/rabbit-video/character-reference.jpg` | Master Image | Original full-body bunny reference on `#00FF00` |
| Thumbnail | `public/characters/rabbit-video/character-thumbnail.png` | Portrait `256×256` | Keyed portrait on dark studio gradient (used in Settings) |
| `idle` | `public/characters/rabbit-video/animations/idle/idle.mp4` | Loop | Relaxed standing idle + natural blinking & breathing |
| `waving` | `public/characters/rabbit-video/animations/gestures/waving.mp4` | One-shot (`0.0s–3.3s`) | Pulls paw from hoodie pocket, waves warmly, returns to idle |
| `walking` | `public/characters/rabbit-video/animations/movement/walking.mp4` | Loop | Right-facing walk cycle (auto-flips horizontally when walking left) |
| `thinking` | `public/characters/rabbit-video/animations/assistant/thinking.mp4` | One-shot (`2.80s`) | Finger to chin with tilted head; unlocks **Think** action & AI `thinking` state |
| `happy` | `public/characters/rabbit-video/animations/emotions/happy.mp4` | One-shot (`2.40s`) | Joyful hop & raised-arms cheer; unlocks **Cheer** action & `happy` state |
| `surprised` | `public/characters/rabbit-video/animations/emotions/surprised.mp4` | One-shot (`2.05s`) | Startled jump with wide eyes & "O" mouth; unlocks **Surprised** action & collision reaction |
| `falling` | `public/characters/rabbit-video/animations/physics/falling.mp4` | Loop (`3.24s`) | Mid-air arms windmilling & kicking legs; plays on drag (`being_dragged`), `falling`, and `rising` |
| `landing` | `public/characters/rabbit-video/animations/physics/landing.mp4` | One-shot (`1.30s`) | Touchdown impact & cushioned squat; plays on `landing` and `bouncing`, then advances to `recovering` |
| `recovering` | `public/characters/rabbit-video/animations/physics/recovering.mp4` | One-shot (`3.00s`) | Stands up, dusts hands, slips paws back into pockets in neutral idle |

### How Dynamic Action Filtering Works
- In `src/App.tsx`, `src/components/InteractionMenu.tsx`, and `src/components/ActionsAndPosesPanel.tsx`, when **Rabbit** is selected in Settings, the **Actions** menu automatically shows **only** the actions backed by an entry in `public/characters/rabbit-video/character.json` (currently **Wave**, **Walk**, **Cheer**, **Think**, and **Surprised**).
- **Whenever you add a new animation clip** to `public/characters/rabbit-video/character.json`, it will automatically unlock in `InteractionMenu`, `ActionsAndPosesPanel`, and `resolveVideoAnimation()` (`src/services/videoCharacterManifest.ts`) with no UI changes required.

### Quick Guide: Adding a New Clip or 3-Action Batch Clip
1. Drop the `.mp4` (green screen `#00FF00`) or `.webm` (VP9 transparent `alpha: true`) into `public/characters/rabbit-video/animations/<category>/`.
2. Add entries inside `"animations"` in `public/characters/rabbit-video/character.json`:
   ```json
   "thinking": {
     "file": "./characters/rabbit-video/animations/packs/batch-1.mp4",
     "category": "assistant",
     "durationSec": 3.0,
     "startTime": 0.0,
     "endTime": 3.0,
     "loop": true,
     "alpha": false,
     "priority": 2
   }
   ```
   - Set `"alpha": true` if you processed the video into a transparent `.webm`.
   - Set `"startTime"` and `"endTime"` when slicing multiple actions out of a single 9–10s Gemini video (`loop: true` loops within `[startTime, endTime]`; `loop: false` triggers `onAnimationEnded` and returns to `idle` at `endTime`).

---

## 2. Shared Framing & Negative Rules (Attach `character-reference.jpg` to Every Prompt)

> **Important Reference Lock:** Keep the exact white furry bunny from `character-reference.jpg` (royal blue glowing wireless headphones with bunny logos, royal blue hoodie with white drawstrings and bunny emblem, matching blue joggers, blue-and-white sneakers, pink inner ears, fluffy white tail).  
> **Framing:** Locked static eye-level camera, zero pan/tilt/zoom. Full body from tall ear tips to sneaker soles centered in the middle third of the 16:9 frame so our center portrait crop captures 100% of hands and ears while trimming out the bottom-right corner watermark.  
> **Background:** Completely flat, uniform, shadowless solid chroma-green (`#00FF00`). No floor shadows, no props, no text, no icons, no extra limbs or fingers.

---

## 3. Phase 2 Core Animations ✅ Complete

### ~~Batch 1 — `thinking` + `happy` + `surprised` (9–10s)~~ ✅ Completed & Integrated
- Split into `thinking.mp4` (`2.80s`), `happy.mp4` (`2.40s`), and `surprised.mp4` (`2.05s`) and registered in `character.json` & `videoCharacterManifest.ts`.

### ~~Batch 2 — `falling` → `landing` → `recovering` (9–10s)~~ ✅ Completed & Integrated
- Split into `falling.mp4` (`3.24s`, loop), `landing.mp4` (`1.30s`, one-shot), and `recovering.mp4` (`3.00s`, one-shot) and wired into drag/physics fall-and-recovery transitions (`VideoCharacterStage.tsx` & `App.tsx`).

---

## 4. Remaining Library — Recommended 3-Action Batch Prompts

To stay well within Gemini daily video limits, all remaining **46 animations** are grouped below into **4 dedicated loops** + **14 clean 3-action batch videos** (18 total generations).

### Dedicated Loops (Generate Standalone for Seamless Seam Matching)

#### Loop A — `running` (Category B)
```text
Animate the exact white furry bunny character from the reference image (blue glowing headphones, blue hoodie with bunny logo, blue joggers, blue-and-white sneakers, white tail).
Action: Energetic running cycle in place facing three-quarter right.
Starting & Ending Pose: Forward-leaning athletic running mid-stride, arms bent out of pocket pumping briskly.
Movement Sequence: Fast upbeat running-in-place cycle with higher knee drive, rhythmic pumping elbows, and bouncy ears/drawstrings trailing back slightly. Seamless loop.
Camera & Framing: Locked static eye-level camera, full body centered in middle third. Solid shadowless chroma-green (#00FF00). No motion blur distortion, no text.
```

#### Loop B — `walking-left` (Category B — Optional if you prefer non-mirrored asymmetric logo)
```text
Animate the exact white furry bunny character from the reference image (blue glowing headphones, blue hoodie with bunny logo, blue joggers, blue-and-white sneakers, white tail).
Action: Natural walking cycle in place facing three-quarter LEFT.
Starting & Ending Pose: Mid-stride upright stance turned three-quarter left, hands relaxed swinging at sides.
Movement Sequence: Smooth alternating sneaker steps and opposite arm swing facing left, subtle ear and tail bounce. Seamless loop.
Camera & Framing: Locked static eye-level camera, full body centered in middle third. Solid shadowless chroma-green (#00FF00). No floor shadows, no text.
```

#### Loop C — `sleeping` (Category A/F)
```text
Animate the exact white furry bunny character from the reference image (blue glowing headphones, blue hoodie with bunny logo, blue joggers, blue-and-white sneakers, white tail).
Action: Peaceful sleeping loop.
Starting & Ending Pose: Seated comfortably curled slightly on the ground plane, knees tucked softly, hands resting relaxed in lap, head tilted gently down, eyes softly closed.
Movement Sequence: Slow deep calm chest breathing rising and falling smoothly, ears drooping softly and swaying minimally with breath. Seamless loop.
Camera & Framing: Locked static eye-level camera, full seated body centered in middle third. Solid shadowless chroma-green (#00FF00). No bed, pillow, Zzz text, or floor shadows.
```

#### Loop D — `dancing` (Category F)
```text
Animate the exact white furry bunny character from the reference image (blue glowing headphones, blue hoodie with bunny logo, blue joggers, blue-and-white sneakers).
Action: Playful upbeat headphone dance loop.
Starting & Ending Pose: Upright playful groove stance, knees slightly bent, hands out at waist moving to a beat.
Movement Sequence: Rhythmic alternating shoulder pops, bouncy side-to-side sneaker steps, joyful bent-arm groove swings, ears bouncing happily as if jamming to music on the blue headphones. Seamless loop.
Camera & Framing: Locked static eye-level camera, full body centered in middle third with ear headroom. Solid shadowless chroma-green (#00FF00). No musical notes or text.
```

---

### Category A & F — Idle Variants & Rest Lifecycle (3 Batch Videos)

#### Batch 3 — `breathing` + `blinking` + `small-body-movement` (Category A)
```text
Animate the exact white furry bunny character from the reference image in one locked-camera shot with three subtle idle behaviors:
[0.0s - 3.3s] BREATHING: Upright hands-in-pocket idle; slow gentle chest expansion inhale (1.6s) and relaxed shoulder exhale (1.7s).
[3.3s - 6.6s] BLINKING: Calm upright stance; performs two crisp natural eye blinks spaced unevenly while keeping body steady.
[6.6s - 9.5s] SMALL BODY MOVEMENT: Shifts weight smoothly onto right hip with a tiny relaxed head tilt and slight sneaker toe tap, then shifts cleanly back to centered stance.
Framing & Background: Locked eye-level camera, full body centered in middle third, solid shadowless chroma-green (#00FF00), no text.
```

#### Batch 4 — `looking-around` + `yawning` + `stretching` (Categories A & F)
```text
Animate the exact white furry bunny character from the reference image in one locked-camera shot with three sequential actions returning to neutral hands-in-pocket idle between each:
[0.0s - 3.3s] LOOKING AROUND: Casually turns head and eyes left, pauses curiously with slight ear tilt, sweeps gaze right, returns to center.
[3.3s - 6.6s] YAWNING: Raises right hand politely to cover mouth during a cute drowsy yawn with eyes squeezing softly shut, then drops hand back into pocket with a blink.
[6.6s - 9.5s] STRETCHING: Reaches both arms smoothly overhead in a refreshing full-body stretch lifting slightly onto toes, then rolls shoulders down back into pocket idle.
Framing & Background: Locked eye-level camera with extra headroom above tall ears/hands, full body centered in middle third, solid shadowless chroma-green (#00FF00), no text.
```

#### Batch 5 — `sitting` + `falling-asleep` + `waking-up` + `getting-up` (Split as 2 × 2-Action Clips if Preferred)
*Clip 5a (`sitting` → `falling-asleep`):*
```text
Animate the exact white furry bunny character from the reference image in one locked-camera shot:
[0.0s - 4.5s] SITTING: From neutral standing idle, brings hands out for balance, bends knees smoothly and sits comfortably down on the invisible ground plane with hands resting on knees. Holds seated pose briefly at 4.0s.
[4.5s - 9.5s] FALLING ASLEEP: From that seated pose, eyelids grow heavy and blink slower, head nods drowsily once, then settles gently curled into the peaceful sleeping pose with eyes fully closed.
Framing & Background: Locked eye-level camera, full body centered in middle third, solid shadowless chroma-green (#00FF00), no chair, no Zzz text.
```
*Clip 5b (`waking-up` / `getting-up`):*
```text
Animate the exact white furry bunny character from the reference image in one locked-camera shot:
[0.0s - 5.0s] WAKING UP: Begins curled in peaceful seated sleep with eyes closed; eyes flutter open slowly, stretches face awake with a fresh smile, and pushes smoothly up to standing idle.
[5.0s - 9.5s] GETTING UP: Starting from seated resting posture, leans weight forward, plants sneakers firmly, pushes cleanly upward to neutral standing idle with hands in hoodie pocket.
Framing & Background: Locked eye-level camera, full body centered in middle third, solid shadowless chroma-green (#00FF00), no text.
```

---

### Category B — Remaining Locomotion (1 Batch Video)

#### Batch 6 — `jumping` + `small-hop` + `walking-right` (or dedicated `walking-right` loop)
```text
Animate the exact white furry bunny character from the reference image in one locked-camera shot with three clear motions returning to neutral idle between each:
[0.0s - 3.5s] JUMPING: Quick knee-bend anticipation swinging arms back, springs high vertically with arms raised happily (ears staying inside top frame), lands softly with bent knees and stands back up.
[3.5s - 6.5s] SMALL HOP: Quick lighthearted mini bounce off both sneakers with a playful ear wiggle and immediate soft landing back to idle.
[6.5s - 9.5s] WALKING RIGHT: Turns three-quarter right and walks smoothly in place for 3 seconds with clean alternating stride and arm swing.
Framing & Background: Locked eye-level camera with generous headroom above ears, centered in middle third, solid shadowless chroma-green (#00FF00), no floor shadows or text.
```

---

### Category C — Hand Gestures & Body Actions (3 Batch Videos)

#### Batch 7 — `greeting` + `clapping` + `thumbs-up`
```text
Animate the exact white furry bunny character from the reference image in one locked-camera shot with three clear gestures returning to hands-in-pocket idle between each:
[0.0s - 3.3s] GREETING: Steps neatly, places one paw politely over chest with a warm slight forward bow and welcoming smile, then rises back to idle.
[3.3s - 6.6s] CLAPPING: Brings both paws out to chest height and claps enthusiastically 4 times with joyful bounce and bright smile, then returns hands to pocket.
[6.6s - 9.5s] THUMBS UP: Pulls right paw out to chest height forming a crisp clear thumbs-up with an encouraging wink and smile, then lowers hand back into pocket.
Framing & Background: Locked eye-level camera, full body centered in middle third, solid shadowless chroma-green (#00FF00), clean fingers, no text.
```

#### Batch 8 — `pointing-left` + `pointing-right` + `pointing-up`
```text
Animate the exact white furry bunny character from the reference image in one locked-camera shot with three directional pointing gestures returning to hands-in-pocket idle between each:
[0.0s - 3.3s] POINTING LEFT: Pulls arm out and points cleanly toward screen-left (keeping hand inside middle portrait zone) while glancing left, then returns to pocket.
[3.3s - 6.6s] POINTING RIGHT: Pulls arm out and points cleanly toward screen-right (keeping hand inside middle portrait zone) while glancing right, then returns to pocket.
[6.6s - 9.5s] POINTING UP: Looks slightly upward and points index finger cleanly upward beside ear (keeping fingertip inside frame headroom), then returns to pocket.
Framing & Background: Locked eye-level camera with wide headroom, centered in middle third, solid shadowless chroma-green (#00FF00), clean pointing finger, no text.
```

#### Batch 9 — `pointing-down` + `hands-on-hips` + `shrugging`
```text
Animate the exact white furry bunny character from the reference image in one locked-camera shot with three gestures returning to hands-in-pocket idle between each:
[0.0s - 3.3s] POINTING DOWN: Pulls right hand out, looks down slightly and points cleanly at a downward 45-degree angle, holds briefly, then returns to pocket.
[3.3s - 6.6s] HANDS ON HIPS: Places both hands firmly onto hips with elbows slightly angled out, confident proud smile and subtle nod, then slips hands back into pocket.
[6.6s - 9.5s] SHRUGGING: Pulls both palms upward near waist while raising shoulders toward ears and tilting head in playful uncertainty, then relaxes back to pocket idle.
Framing & Background: Locked eye-level camera, centered in middle third, solid shadowless chroma-green (#00FF00), no text.
```

---

### Category D — Emotional Expressions (3 Batch Videos)

#### Batch 10 — `excited` + `laughing` + `curious`
```text
Animate the exact white furry bunny character from the reference image in one locked-camera shot with three expressions returning to neutral idle between each:
[0.0s - 3.3s] EXCITED: Quick happy micro-bounces on toes, both fists lifted eagerly near chest, sparkling wide eyes and ecstatic smile, settling back to idle.
[3.3s - 6.6s] LAUGHING: Tilts head back lightly in genuine laughter, holds stomach gently with one paw while shoulders shake happily and eyes squeeze into joyful crescents, calming back to idle.
[6.6s - 9.5s] CURIOUS: Leans slightly forward toward viewer, tilts head inquisitively with one ear perked slightly higher and bright intrigued eyes, leaning back to idle.
Framing & Background: Locked eye-level camera with ear headroom, centered in middle third, solid shadowless chroma-green (#00FF00), no text.
```

#### Batch 11 — `sad` + `disappointed` + `shy`
```text
Animate the exact white furry bunny character from the reference image in one locked-camera shot with three softer emotional reactions returning to neutral idle between each:
[0.0s - 3.3s] SAD: Shoulders slump gently, head tilts down, tall ears droop slightly sideways, sympathetic downcast eyes and soft frown, then lifts back to idle.
[3.3s - 6.6s] DISAPPOINTED: Slow sigh dropping shoulders slightly with half-lidded eyes and a small gentle left-right head shake, recovering softly to idle.
[6.6s - 9.5s] SHY: Clasps hands behind back, turns head bashfully slightly down/sideways with rosy pink cheek blush and sweet shy smile, facing forward again.
Framing & Background: Locked eye-level camera, centered in middle third, solid shadowless chroma-green (#00FF00), no text.
```

#### Batch 12 — `confused` + `angry` + (spare polish slot: `happy` alt)
```text
Animate the exact white furry bunny character from the reference image in one locked-camera shot with three reactions returning to neutral idle between each:
[0.0s - 3.3s] CONFUSED: Tilts head 18 degrees sideways, raises one brow furrowed in puzzlement, brings one paw up to lightly scratch temple beside headphone, then returns to idle.
[3.3s - 6.6s] ANGRY (CUTE GRUMPY): Crosses both arms neatly over chest, knits brows slightly with puffed cheeks and one small impatient sneaker tap, then softens back to idle.
[6.6s - 9.5s] PLAYFUL WINK: Gives a charming confident single-eye wink with a bright smile and tiny upbeat ear perk, settling into idle.
Framing & Background: Locked eye-level camera, centered in middle third, solid shadowless chroma-green (#00FF00), no ?/! icons, no text.
```

---

### Category E — AI Assistant Activities (3 Batch Videos)

#### Batch 13 — `listening` + `processing` + `waiting` (Loopable 3s Slices)
```text
Animate the exact white furry bunny character from the reference image in one locked-camera shot with three steady AI assistant states returning to balanced stance between each:
[0.0s - 3.3s] LISTENING: Attentive slight forward lean, gentle understanding micro-nod, ears perked forward as if listening carefully through the blue headphones, warm focused eyes.
[3.3s - 6.6s] PROCESSING: Hands held lightly together near chest, fingers making tiny poised rhythmic working motions with calm concentrated focus and subtle blink.
[6.6s - 9.5s] WAITING: Hands tucked calmly in pocket (or behind back), patient friendly smile, gentle heel-to-toe rock and calm blink.
Framing & Background: Locked eye-level camera, centered in middle third, solid shadowless chroma-green (#00FF00), no UI icons or text.
```

#### Batch 14 — `talking` + `explaining` + `acknowledging`
```text
Animate the exact white furry bunny character from the reference image in one locked-camera shot with three conversational AI states:
[0.0s - 3.5s] TALKING: Mouth animates smoothly in natural conversational speech shapes while hands near waist make subtle friendly talking gestures and light head nods.
[3.5s - 7.0s] EXPLAINING: Active helpful teaching posture—both open palms gesture smoothly outward and inward at chest height to illustrate points while speaking expressively.
[7.0s - 9.5s] ACKNOWLEDGING: Crisp single affirmative head nod paired with a quick confident chest-level hand confirmation and bright assured smile, returning to pocket idle.
Framing & Background: Locked eye-level camera, centered in middle third, solid shadowless chroma-green (#00FF00), no speech bubbles or text.
```

#### Batch 15 — `task-completed` + `error-reaction` + `notification`
```text
Animate the exact white furry bunny character from the reference image in one locked-camera shot with three crisp assistant reaction clips returning to pocket idle between each:
[0.0s - 3.3s] TASK COMPLETED: Satisfied nod followed by a crisp victorious mini fist-pump at chest height with a happy bounce and proud smile, then hand back in pocket.
[3.3s - 6.6s] ERROR REACTION: Tiny apologetic half-step back raising both open palms near chest while shaking head gently left-right with concerned eyebrows, then back to idle.
[6.6s - 9.5s] NOTIFICATION: Ears snap briskly upright, head perks slightly upper-right in alert attention, taps one blue headphone earcup or raises one finger ("hey!"), then settles to idle.
Framing & Background: Locked eye-level camera, centered in middle third, solid shadowless chroma-green (#00FF00), no checkmarks/bells/icons, no text.
```

---

### Category F — Remaining Playful & Personality (1 Batch Video)

#### Batch 16 — `celebrating` + `cheering` + `playful-reaction`
```text
Animate the exact white furry bunny character from the reference image in one locked-camera shot with three celebratory actions returning to pocket idle between each:
[0.0s - 3.3s] CELEBRATING: Punches both arms high overhead in victory with a joyful upward leap (keeping hands and ears inside top frame), lands softly and lowers arms to pocket.
[3.3s - 6.6s] CHEERING: Waves both arms enthusiastically upward-outward twice with upbeat bouncy knees and encouraging open smile, then lowers arms to pocket.
[6.6s - 9.5s] PLAYFUL REACTION: Performs a brisk playful 360-degree spin in place, lands facing camera popping one cute peace-sign hand out with a cheeky wink, then returns to pocket idle.
Framing & Background: Locked eye-level camera with extra headroom above raised hands/ears, centered in middle third, solid shadowless chroma-green (#00FF00), no confetti or text.
```

---

## 5. Production Checklist Summary

- [x] **Character Reference & Studio Thumbnails:** `robo/character-thumbnail.png`, `rabbit-video/character-reference.jpg`, `rabbit-video/character-thumbnail.png`
- [x] **Settings Integration:** Robo (Default) / Rabbit picker + Scale In / Scale Out (60%–200%) + Persistence
- [x] **Core Wrapped Animations:** `idle`, `waving`, `walking`
- [x] **UI Filtering:** `InteractionMenu` & `ActionsAndPosesPanel` show only available Rabbit actions
- [ ] **Phase 2 Finishers:** Batch 1 (`thinking`, `happy`, `surprised`) + Batch 2 (`falling`, `landing`, `recovering`)
- [ ] **Remaining Loops:** `running`, `walking-left`, `sleeping`, `dancing`
- [ ] **Remaining Batches (3–16):** Categories A–F (42 remaining actions)
- [ ] **Optional Phase 3 WebM Conversion:** Convert `.mp4` clips to native alpha `.webm` (`yuva420p`) once `ffmpeg` + temporal matting are run
