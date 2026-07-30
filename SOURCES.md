# Sources and provenance

## Collaboration source

This lab was commissioned from a public concept exchange between
Sefray セーフ雷 (`@Sefray1`) and Trent Slade (`@qsolimc`). The preserved
excerpt is in [`docs/concept-thread.md`](docs/concept-thread.md).

The supplied discussion framed the project around two linked ideas:

1. animate the coin rotation paradox being solved; and
2. show why apparently incompatible answers can arise from different
   perspectives or reference frames.

No third-party image is required at runtime. The visualization is generated
algorithmically by the browser.

## Mathematical references

- Eric W. Weisstein, **“Coin Paradox,” MathWorld**  
  <https://mathworld.wolfram.com/CoinParadox.html>

- Eric W. Weisstein, **“Epicycloid,” MathWorld**  
  <https://mathworld.wolfram.com/Epicycloid.html>

- **“Epicycloid,” Encyclopedia of Mathematics**  
  <https://encyclopediaofmath.org/wiki/Epicycloid>

- **“Epicycloid,” Encyclopædia Britannica (1911)**, preserved by Wikisource  
  <https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Epicycloid>

- Osvaldo L. Santos-Pereira, **“Roulette curves, coin paradox and Aristotle's
  wheel paradox”** (2025), arXiv:2512.00123  
  <https://arxiv.org/abs/2512.00123>

## Terminology

A point on the rim of a circle rolling externally around another circle traces
an **epicycloid**. Internal rolling gives a **hypocycloid**. Moving the tracked
point away from the rim gives the corresponding trochoid families.

The phrase **coin rotation paradox** refers to the equal-radius external case:
the moving coin completes two rotations relative to fixed space during one
orbit of the stationary coin.

## Reference-frame convention used by this repository

The application separates three quantities:

```text
laboratory turns = absolute coin orientation / 2π
orbital turns    = orbital angle α / 2π
radial turns     = laboratory turns - orbital turns
```

For external rolling:

```text
laboratory turns after one orbit = R/r + 1
radial turns after one orbit     = R/r
```

This convention is declared explicitly because the word “rotation” is
otherwise underspecified.
