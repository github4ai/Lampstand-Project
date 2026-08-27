!include nsDialogs.nsh
!include LogicLib.nsh

!ifndef BUILD_UNINSTALLER
Var LampstandOllamaCheckbox
Var LampstandPythonCheckbox
Var LampstandInstallOllama
Var LampstandInstallPython

Function LampstandOptionalComponentsPage
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 28u "Optional local AI components"
  Pop $0
  CreateFont $1 "$(^Font)" "10" "700"
  SendMessage $0 ${WM_SETFONT} $1 1

  ${NSD_CreateLabel} 0 30u 100% 28u "Lampstand Project works without these components. Select only what this computer needs. Downloads require an internet connection and can extend installation time."
  Pop $0

  ${NSD_CreateCheckbox} 0 66u 100% 14u "Install Ollama and the recommended local translation model"
  Pop $LampstandOllamaCheckbox
  ${NSD_SetState} $LampstandOllamaCheckbox ${BST_CHECKED}

  ${NSD_CreateLabel} 18u 82u 94% 20u "Recommended for private local chat and translation. The model download uses several gigabytes."
  Pop $0

  ${NSD_CreateCheckbox} 0 110u 100% 14u "Install Python dependencies and Local Whisper"
  Pop $LampstandPythonCheckbox
  ${NSD_SetState} $LampstandPythonCheckbox ${BST_CHECKED}

  ${NSD_CreateLabel} 18u 126u 94% 20u "Recommended for pronunciation, private audio transcription, and document-processing features."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function LampstandOptionalComponentsLeave
  ${NSD_GetState} $LampstandOllamaCheckbox $LampstandInstallOllama
  ${NSD_GetState} $LampstandPythonCheckbox $LampstandInstallPython
FunctionEnd

!macro customPageAfterChangeDir
  Page custom LampstandOptionalComponentsPage LampstandOptionalComponentsLeave
!macroend
!endif

!macro customInstall
  DetailPrint "Installing Lampstand Project application files..."
  DetailPrint "Copying the bundled Ministry and School libraries. This is the largest step and can take several minutes."
  DetailPrint "Your existing reading progress, annotations, profiles, and preferences will be retained."

  StrCpy $2 ""
  ${If} $LampstandInstallOllama == ${BST_CHECKED}
    StrCpy $2 "$2 -InstallOllama"
  ${EndIf}
  ${If} $LampstandInstallPython == ${BST_CHECKED}
    StrCpy $2 "$2 -InstallPython"
  ${EndIf}

  ${If} $2 != ""
    DetailPrint "Installing selected optional AI components. Downloads may take several minutes..."
    nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\scripts\install-standard-ai.ps1" -StudioRoot "$INSTDIR\resources" $2'
    Pop $0
    ${If} $0 != 0
      MessageBox MB_OK|MB_ICONEXCLAMATION "Lampstand Project was installed, but one or more optional AI components could not be completed.$\r$\n$\r$\nYou can retry them later from Settings."
    ${EndIf}
  ${EndIf}
!macroend
