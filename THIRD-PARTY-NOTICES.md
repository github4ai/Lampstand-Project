# Third-party notices

Lampstand Project is released under the MIT licence (see [LICENSE](LICENSE)). It also ships, and
talks to, software written by other people. This file lists both.

## Bundled with the app

These Python packages are copied into `python_overrides/` in the source tree and travel in the
installer. They are used by the pronunciation feature on Language Tools, which needs a speech
engine that works offline from the app's own files. Each package keeps its own licence; the full
text of every one of them is inside the matching `*.dist-info/licenses/` folder next to the code.

| Package | Version carried | Licence |
| --- | --- | --- |
| aiohappyeyeballs | 2.7.1 | PSF-2.0 |
| aiohttp | 3.14.3 | Apache-2.0 AND MIT |
| aiosignal | 1.4.0 | Apache-2.0 |
| attrs | 26.1.0 | MIT |
| certifi | 2026.7.22 | MPL-2.0 |
| edge-tts | 7.3.1 | LGPLv3 (`srt_composer.py` alone is MIT) |
| edge-playback | copied beside edge-tts, never imported by the app | **no licence file travels with this copy** - see below |
| frozenlist | 1.8.0 | Apache-2.0 |
| idna | 3.18 | BSD-3-Clause |
| multidict | 6.7.1 | Apache-2.0 |
| propcache | 0.5.2 | Apache-2.0 |
| tabulate | 0.10.0 | MIT |
| typing_extensions | 4.16.0 | PSF-2.0 |
| yarl | 1.24.5 | Apache-2.0 |

The JavaScript and CSS dependencies are listed in `package.json` and are installed from npm at build
time; none of their sources are hand-copied into the tree.

`edge-playback` came across with `edge-tts`, but nothing in this app imports it and no licence text
was copied with it. It should be removed from `python_overrides/` at the next chance to do so, which
leaves only clearly licensed code in the installer.

## Never bundled: services the app starts or talks to

The app drives these programs over localhost on the operator's own machine. They are installed by
the operator, updated by their own publishers, and are **not** distributed with Lampstand Project.
Programs whose licence would require this app to be released under the same terms - copyleft ones
such as Voice Studio (AGPL-3.0) and ComfyUI (GPL-3.0) - are deliberately kept outside the installer,
and the app only ever calls the copy the operator already has.

| Program | Where it comes from | Licence as published |
| --- | --- | --- |
| Ollama | the operator's own install | the upstream project's own terms |
| ComfyUI | https://github.com/comfyanonymous/ComfyUI | GPL-3.0 |
| Wan2GP | https://github.com/deepbeepmeep/Wan2GP | WanGP Community License 2.0 |
| Ultimate TTS Studio | https://github.com/SUP3RMASS1VE/Ultimate-TTS-Studio-SUP3R-Edition | no licence file in the upstream repository |
| Voice Studio | the operator's own install | AGPL-3.0 |
| Pinokio | the operator's own install | the upstream project's own terms |

Model weights, checkpoints and the hymn, Bible and library data are separate works with their own
terms, are downloaded by those programs rather than by this app, and are not redistributed here.

## Model voices and audio

The pronunciation feature reaches a Microsoft Edge text-to-speech endpoint when it is online. That is
a network call made by the operator's machine under Microsoft's own terms; no Microsoft audio,
voice model, or code is copied into this project.
