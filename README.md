# Coin Rotation Paradox Lab

An offline, dependency-free canvas laboratory for the **coin rotation paradox**,
reference frames, no-slip rolling, epicycloids, hypocycloids, and the deceptively
important `+1`.

**Play the lab:** <https://qsolkcb.github.io/coin/>

The interface adapts the instrument-panel design language of
[QSOLKCB/VORTEX](https://github.com/QSOLKCB/VORTEX) to a different job:
showing the *same rolling motion in several reference frames at once*.

## Bottom line

For a circle of radius `r` rolling externally around a fixed circle of radius
`R`, without slipping,

```text
N_lab = (R + r) / r = R/r + 1
```

where `N_lab` is the moving circle's number of rotations relative to fixed
space during one complete orbit.

For equal circles, `R = r`, so

```text
N_lab = 1 + 1 = 2
```

Sefray's centre-path hunch is therefore correct. The moving centre does not
travel a circle of radius `R`; it travels a circle of radius `R + r`. Its full
path length is

```text
C_center = 2π(R + r)
```

and dividing that by the moving coin's circumference `2πr` gives the same
rotation count.

## Why another observer can count one

A co-rotating radial frame turns once while following the coin around the
fixed circle. In that frame,

```text
N_radial = N_lab - 1 = R/r
```

For equal circles:

```text
N_lab    = 2
N_radial = 1
N_orbit  = 1
```

Both counts can be correct because they answer different questions. The lab
makes the reference frame explicit instead of letting it hide inside the word
“rotation.”

## What the lab shows

- **Laboratory frame** — coin orientation measured against fixed space.
- **Co-rotating radial frame** — the orbital angle is subtracted.
- **Unwrapped tangent frame** — rolling along the fixed boundary gives `R/r`.
- **Marker curve** — epicycloid, hypocycloid, epitrochoid, or hypotrochoid.
- Live no-slip residual calculated from the contact-point velocity.
- External and internal rolling modes.
- Equal-circle, `3:1`, cardioid, and internal `2:1` presets.
- Local PNG, WebM, and deterministic JSON capture.
- No server, package manager, CDN, framework, analytics, or network API.

## Run locally

No install or build step is required. Open `index.html` directly, or serve the
folder with:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Run the smoke suite with:

```bash
node tests/smoke.mjs
```

## Controls

- Press **Space** to pause or resume.
- Scrub **Orbital phase α** to inspect an exact instant.
- Switch between external epicycloid and internal hypocycloid geometry.
- Move the marker away from the rim to generate trochoid variants.
- Choose **Four-perspective comparison** to see the disagreement resolve
  simultaneously.
- Export and reload a local settings receipt.

## Mathematical model

Let `α` be the orbital angle of the rolling centre.

### External rolling

```text
C(α) = (R + r)(cos α, sin α)
φ_lab(α) = ((R + r)/r) α
φ_radial(α) = φ_lab(α) - α = (R/r) α
```

For a rim marker initially placed at the contact point,

```text
P(α) = C(α) - r(cos φ_lab, sin φ_lab)
```

which traces an epicycloid.

### Internal rolling

For `R > r`,

```text
C(α) = (R - r)(cos α, sin α)
φ_lab(α) = -((R - r)/r) α
φ_radial(α) = φ_lab(α) - α = -(R/r) α
```

A rim marker traces a hypocycloid. The negative sign records the reversed spin
direction.

### No-slip invariant

The instantaneous velocity of the contact point is computed as

```text
v_contact = v_center + ω × ρ_contact
```

and should be zero in the fixed-circle frame. The live residual is displayed
in the readout and tested in CI.

## Interpretation boundary

This is a planar kinematics and visualization lab. Reference-frame reasoning
is useful far beyond coins, but analogy is not identity. The application does
not claim that coin geometry proves a model of polarization, cosmology,
orbital mechanics, theology, or consciousness.

## Provenance and references

The collaboration prompt and permission are preserved in
[`docs/concept-thread.md`](docs/concept-thread.md). Mathematical references
and historical notes are collected in [`SOURCES.md`](SOURCES.md).

## Licence

Source code and documentation are licensed under the
[Mozilla Public License 2.0](LICENSE).
