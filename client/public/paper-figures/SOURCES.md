# Original paper figures

The image filenames below identify local research copies retrieved on 2026-10-09 from official, versioned arXiv HTML. Git ignores these image files; they are not distributed in the public repository or site. The site loads each image directly from its official arXiv URL and links to the corresponding caption. Chinese reading explanations are stored separately in `shared/static/data/classic-figures.ts`, `paper-figures.ts`, and `vommi-figures.ts`.

The reviewed source HTML pages identify the submissions under **arXiv.org perpetual non-exclusive license** and link to [arXiv's license information](https://info.arxiv.org/help/license/index.html#licenses-available). This records the source's license notice; it does not label the figures as Creative Commons, assign a new license, or grant this project image redistribution rights. Author credit and a link to the exact source figure accompany every displayed image.

## ACT — arXiv:2304.13705v1

Credit: Tony Z. Zhao, Vikash Kumar, Sergey Levine, and Chelsea Finn, 2023.

- **Fig. 3 — Architecture of Action Chunking with Transformers (ACT).** Original caption distinguishes the training-only CVAE encoder on the left from the policy decoder on the right. The latent variable is set to the prior mean, zero, at test time.
  - File: `act-v1-fig3-architecture.svg`
  - Figure context: https://arxiv.org/html/2304.13705v1#S3.F3
  - Exact original image: https://arxiv.org/html/2304.13705v1/algo.svg
  - SHA-256: `5ee4a4c2e4dcfd81b7953d9ca300d393d7f8e05a6a86c061a8ef4d47cd4b8e12`
- **Fig. 10 — Detail architecture of Action Chunking with Transformers (ACT).** This is the detailed architecture figure in the appendix, complementary to Fig. 3.
  - File: `act-v1-fig10-detailed-architecture.svg`
  - Figure context: https://arxiv.org/html/2304.13705v1#A0.F10
  - Exact original image: https://arxiv.org/html/2304.13705v1/detail_architecture.svg
  - SHA-256: `c014d1e7845bb120a5ee692b5bfe222817c7db4a017f706d01f1b10593a5bcfc`

Both original SVG files were parsed and checked for script elements, inline event handlers, foreign objects, and external resource references; none were found.

## UMI — arXiv:2402.10329v1

Credit: Cheng Chi et al., 2024.

- **Fig. 5 — UMI Policy Interface Design.** The original method figure shows observation latency compensation, the policy interface, and execution latency compensation. It is not an experimental results plot.
  - File: `umi-v1-fig5-policy-interface.png` (2037 × 637 pixels)
  - Figure context: https://arxiv.org/html/2402.10329v1#S3.F5
  - Exact original image: https://arxiv.org/html/2402.10329v1/UMI-method.png
  - SHA-256: `056c2c5d4265dbc6b0e7338353dc6fd9d57083841f751e856d64a502887c09f4`

## Mobile ALOHA — arXiv:2401.02117v1

Credit: Zipeng Fu, Tony Z. Zhao, and Chelsea Finn, 2024.

- **Figure 1 — Hardware Details.** The original system figure shows the teleoperation setup, autonomous execution configuration, workspace, and technical specifications. This is a hardware/system architecture figure, not a learning-network diagram or experimental results plot.
  - File: `mobile-aloha-v1-fig1-hardware.png` (2040 × 510 pixels)
  - Figure context: https://arxiv.org/html/2401.02117v1#S2.F1
  - Exact original image: https://arxiv.org/html/2401.02117v1/hardware.png
  - SHA-256: `20519aa6db1ab590f7ff8146cd22e84bbd199410fc8c448c80f0a3e5a1deab83`

## RoboPace — arXiv:2610.09696v1

Credit: Mimo Shirasaka et al., 2026.

- **Figure 2 — RoboPace System Overview.** Contact-aware TOPP-RA retimes the policy path; free-space motion and predicted contact receive different speed limits.
  - File: `robopace-fig2-original.png` (990 × 281 pixels)
  - Figure context: https://arxiv.org/html/2610.09696v1#S2.F2
  - Exact original image: https://arxiv.org/html/2610.09696v1/fig_overview.png

## LLA-MPPI — arXiv:2610.10465v1

Credit: Sebin Jung et al., 2026.

- **Figure 2 — Look-back and look-ahead control pipeline.** GPU model selection and CPU MPPI planning run asynchronously. The paper does not demonstrate a wheel-legged arm system.
  - File: `lla-mppi-fig2-original.png` (1289 × 620 pixels)
  - Figure context: https://arxiv.org/html/2610.10465v1#S3.F2
  - Exact original image: https://arxiv.org/html/2610.10465v1/llamppi_pipeline.png

## VOMMI — arXiv:2610.08220v1

Credit: Yutian Zhang et al., 2026. The official HTML identifies its submission license as **arXiv.org perpetual non-exclusive license** and links to https://info.arxiv.org/help/license/index.html#licenses-available. The local research copies match assets from that versioned HTML; they are ignored by Git and are not published by this project. This record does not assert a Creative Commons license.

- **Figure 3 — Overview of VOMMI.** The online RGB motion estimator conditions the base-action residual; the offline branch combines the causal estimator with frozen VGGT anchors and applies planar Body compensation to the Hand stream. The figure includes the DeepRobotics M20S wheel-legged platform with a CM1 manipulator. Collection-time reference pose supervision is not a deployment policy input. The paper does not claim a dynamic whole-body controller.
  - File: `vommi-v1-fig3-framework.png` (3580 × 1694 pixels; transparent PNG)
  - Figure context and caption: https://arxiv.org/html/2610.08220v1#S5.F3
  - Exact original image: https://arxiv.org/html/2610.08220v1/figures/Figure2.png
  - SHA-256: `e6889097a31aca1c983956ce071109251bbe80bb23a194ce58977875a96dd333`
- **Figure 2 — Portable data collection interface.** Independent Body and Hand RGB views are timestamped into a robot-compatible episode. The illustration also shows the M20S wheel-legged manipulator used for deployment.
  - File: `vommi-v1-fig2-data-interface.png` (1750 × 675 pixels)
  - Figure context and caption: https://arxiv.org/html/2610.08220v1#S3.F2
  - Exact original image: https://arxiv.org/html/2610.08220v1/datapipeline.png
  - SHA-256: `33c5600376e8500b4d7990575b8d6e647df484c4760e2ba653c93de68d2cac24`
