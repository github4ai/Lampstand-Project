!include nsDialogs.nsh
!include LogicLib.nsh

!ifndef BUILD_UNINSTALLER
; Electron names the personal data folder after package.json "name", not the product title.
!define LAMPSTAND_DATA_DIR "$APPDATA\lampstand-studio"

Var LampstandOllamaCheckbox
Var LampstandPythonCheckbox
Var LampstandInstallOllama
Var LampstandInstallPython
Var LampstandEraseDataCheckbox
Var LampstandEraseData

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

Function LampstandExistingDataPage
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 28u "Existing data on this computer"
  Pop $0
  CreateFont $1 "$(^Font)" "10" "700"
  SendMessage $0 ${WM_SETFONT} $1 1

  ${NSD_CreateLabel} 0 30u 100% 40u "Lampstand Project keeps your reading progress, annotations, profiles, preferences, and the files you added to the local library. Nothing is removed unless you ask for it."
  Pop $0

  ${NSD_CreateRadioButton} 0 78u 100% 14u "Keep my data (recommended)"
  Pop $0
  ${NSD_Check} $0

  ${NSD_CreateRadioButton} 0 98u 100% 14u "Erase all Lampstand data on this computer and start fresh"
  Pop $LampstandEraseDataCheckbox

  ${NSD_CreateLabel} 18u 114u 94% 40u "Removes the personal data folder for every profile on this computer, including locally added library files. The bundled libraries are copied again on first launch, which takes several minutes. Back up first from Settings if you may want this data later."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function LampstandExistingDataLeave
  ${NSD_GetState} $LampstandEraseDataCheckbox $LampstandEraseData
FunctionEnd

!macro customPageAfterChangeDir
  Page custom LampstandOptionalComponentsPage LampstandOptionalComponentsLeave
  Page custom LampstandExistingDataPage LampstandExistingDataLeave
!macroend
!endif

!macro customInstall
  DetailPrint "Installing Lampstand Project application files..."
  DetailPrint "Copying the bundled Ministry and School libraries. This is the largest step and can take several minutes."

  ${If} $LampstandEraseData == ${BST_CHECKED}
    MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "Erase all Lampstand data on this computer?$\r$\n$\r$\nThis permanently removes ${LAMPSTAND_DATA_DIR}: reading progress, annotations, profiles, preferences, and every file added to the local library. It cannot be undone.$\r$\n$\r$\nChoose No to keep your data." /SD IDNO
    StrCpy $3 $0
    ${If} $3 == IDYES
      ${If} ${FileExists} "${LAMPSTAND_DATA_DIR}\*.*"
        DetailPrint "Erasing existing Lampstand data as requested..."
        RMDir /r "${LAMPSTAND_DATA_DIR}"
        ${If} ${FileExists} "${LAMPSTAND_DATA_DIR}\*.*"
          DetailPrint "Some data files were still in use and remain on disk. Close Lampstand Project and run this installer again to finish erasing them."
        ${Else}
          DetailPrint "Lampstand data erased. The bundled libraries are copied again on first launch."
        ${EndIf}
      ${Else}
        DetailPrint "There was no existing Lampstand data to erase."
      ${EndIf}
    ${Else}
      DetailPrint "Your existing reading progress, annotations, profiles, and preferences will be retained."
    ${EndIf}
  ${Else}
    DetailPrint "Your existing reading progress, annotations, profiles, and preferences will be retained."
  ${EndIf}

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
