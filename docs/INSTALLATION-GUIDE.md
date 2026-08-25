# Lampstand Project Installation Guide

## Windows requirements

- Windows 10 or Windows 11, 64-bit.
- At least 4 GB of free space for the application and bundled reading libraries.
- Additional space is required only for optional local AI models.
- A GPU is optional for reading, School, Church, documents, and ordinary chat. A capable NVIDIA GPU is recommended for high-quality local image, audio, and video generation.

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

## First-run checks

1. Open **Settings**.
2. Choose **Check all services**.
3. Confirm the Lampstand backend is connected.
4. Install optional services only when their features are required.
5. Open Ministry and verify that the bundled library cards appear.

## Updates

Open **Settings → App updates → Check for updates**. Downloaded updates install after Lampstand restarts. Locally stored profiles, annotations, progress, and preferences are retained.

## Troubleshooting

- If the window is blank, close Lampstand completely and reopen it. If necessary, use the installed repair option.
- If `127.0.0.1:9656` is unavailable, use **Repair services** and review the desktop startup log from Settings.
- If sign-in says the email is not invited, the owner must add that exact email in remote access control.
- If a JWT has expired, choose **Use another email** and sign in again.
- If Windows blocks an unsigned installer, confirm it came from the approved Lampstand release before continuing.

## Uninstalling

Use **Windows Settings → Apps → Installed apps → Lampstand Project → Uninstall**. The installer is configured not to delete user data automatically. Back up important notes and progress before manually removing data folders.

