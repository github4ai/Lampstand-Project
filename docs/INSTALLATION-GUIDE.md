# Lampstand Project Installation Guide

## Windows requirements

- Windows 10 or Windows 11, 64-bit.
- At least 4 GB of free space for the application and bundled reading libraries.
- Additional space is required only for optional local AI models.
- A GPU is optional for reading, School, Church, documents, and ordinary chat. A capable NVIDIA GPU is recommended for high-quality local image, audio, and video generation.
- Microsoft PowerPoint is optional. Presentation Studio converts a `.pptx` or `.ppt` deck into projected slides by opening it in PowerPoint on this computer; without PowerPoint, save the deck as a PDF and the app projects that page by page.
- A microphone and a second speaker output are optional, for sending a live speaker's voice to the room from Presentation Studio. Nothing is recorded.

## Install the app

1. Download `Lampstand-Project-Setup-<version>.exe` from the approved Lampstand release page.
2. Close any older Lampstand window.
3. Run the installer and choose an installation folder.
4. Launch **Lampstand Project** from the Desktop or Start menu.
5. Sign in with the exact email invited by the Lampstand owner.

Reinstallation is not required when changing a profile from Owner, Adult, or Student. Access is assigned remotely and applied after the member signs in.

## What the installer includes

The installer includes the application and packaged reading libraries:

- Holy Word for Morning Revival;
- Hymnal;
- Recovery Bible;
- Recovery Bible footnotes;
- Life-Study of the Bible;
- Ministry Books.

The source folders used to prepare a release are not required on a family member's computer.

## Optional AI dependencies

Ollama, Local Whisper, ComfyUI, ACE-Step, and WanGP are not part of the core reading-library bundle. They are large, hardware-dependent components. Install only the features needed on that computer from **Settings → Services and dependencies**.

- **Ollama:** local chat and translation models.
- **Local Whisper:** private audio transcription.
- **ComfyUI:** local image generation.
- **ACE-Step:** local song and instrumental generation.
- **WanGP/LTX:** local video generation.

Computers with limited storage can use the core app without these large model packages.

## Existing data

The installer shows an **Existing data on this computer** page on every install and update. **Keep my data (recommended)** is selected; choosing it, or pressing Enter, leaves reading progress, annotations, profiles, preferences, and files added to the local library exactly where they are.

The second choice, **Erase all Lampstand data on this computer and start fresh**, asks for confirmation and then removes the personal data folder `%APPDATA%\lampstand-studio` before the new version is installed. Every profile on that computer loses its data, and the bundled libraries are copied again on first launch, which takes several minutes. Downloaded and generated media are stored outside that folder and are not removed.

An installer run without interaction — for example a deployment script that passes `/S` — never erases anything; the confirmation defaults to keeping data. If the app was still open during an erase, some files cannot be removed and the installer reports that it left them on disk; close Lampstand and run the installer again to finish.

## First-run checks

1. Open **Settings**.
2. Choose **Check all services** — the circular-arrow button at the top right of the page. Every Settings control that shows only an icon names itself on hover or keyboard focus.
3. Confirm the Lampstand backend is connected.
4. Install optional services only when their features are required.
5. Open Ministry and verify that the bundled library cards appear.

## Updates

Open **Settings → App updates** and select **Check for app updates** (the circular-arrow button). Downloaded updates install after Lampstand restarts. Locally stored profiles, annotations, progress, and preferences are retained.

## Troubleshooting

- If the window is blank, close Lampstand completely and reopen it. If necessary, use the installed repair option.
- If `127.0.0.1:9656` is unavailable, use **Repair services** (the wrench in **Settings → AI Services**) and review the desktop startup log from Settings.
- If sign-in says the email is not invited, the owner must add that exact email in remote access control.
- If a JWT has expired, choose **Use another email** and sign in again.
- If Windows blocks an unsigned installer, confirm it came from the approved Lampstand release before continuing.

## Uninstalling

Use **Windows Settings → Apps → Installed apps → Lampstand Project → Uninstall**. The installer is configured not to delete user data automatically. Back up important notes and progress before manually removing data folders.

