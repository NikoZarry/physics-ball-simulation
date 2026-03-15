# Physics Ball Simulation

An interactive browser-based physics simulation of a bouncing ball with real-time energy and momentum diagnostics. Built with vanilla HTML, CSS, and JavaScript — no libraries or frameworks.

**[Live Demo](https://nikozarry.github.io/physics-ball-simulation/)** ← *(runs in any browser, no install needed)*

## What It Simulates

A ball subject to:
- **Gravity** — constant downward acceleration
- **Quadratic aerodynamic drag** — force scales with v² and cross-sectional area
- **Elastic collisions** — walls, floor, and ceiling with a configurable restitution coefficient
- **Floor friction** — horizontal damping on ground contact
- **Density-scaled mass** — mass scales with r³ when you resize the ball (constant density model)

## Features

- Drag and throw the ball with your mouse or finger
- Toggle drag force on/off (button or press `D`)
- Resize the ball with buttons or `↑` / `↓` arrow keys (press `R` to reset)
- Real-time HUD showing:
  - Frame delta time
  - Ball mass and radius
  - Velocity components (vx, vy)
  - Kinetic energy (K), potential energy (U), total energy (E)
  - Momentum magnitude (|p|)
  - All values displayed in SI prefix notation (m, k, M, etc.)
- Fixed-timestep physics loop at 120 Hz for stable simulation regardless of frame rate

## Physics Details

| Quantity | Formula |
|----------|---------|
| Drag force | `F = -0.5 · ρ · Cd · A · v·|v|` |
| Mass (density mode) | `m = m₀ · (r/r₀)³` |
| Restitution | `v_new = -e · v_old` |
| Kinetic energy | `K = 0.5 · m · v²` |
| Potential energy | `U = m · g · h` |
| Momentum | `p = m · v` |

## Controls

| Input | Action |
|-------|--------|
| Click + drag ball | Throw the ball |
| `D` key | Toggle drag on/off |
| `↑` / `↓` arrow keys | Increase / decrease ball size |
| `R` key | Reset ball to default size |

## Usage

No build step needed. Just open the file:

```bash
open index.html
# or drag index.html into your browser
```

## Project Structure

```
physics-ball-simulation/
├── index.html    # HTML canvas setup
├── script.js     # Physics engine and rendering loop
└── style.css     # Dark theme styling
```

---

*Hidekel Irizarry | Mechanical Engineering @ UCF*
