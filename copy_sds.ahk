; scroll_and_capture.ahk
#Requires AutoHotkey v2.0
#SingleInstance Force

; 🔍 Adjust screenshot save folder:
saveDir := "C:\Users\cd02m\OneDrive\Desktop\Chem_Database\Chemical-Database-Generator\temp_pdf\screenshots"

; Ensure the browser window is focused
WinActivate("Fisher Scientific")
Sleep(2000)

; Click the center of the viewer to focus it
MouseMove 800, 400
Click
Sleep(1500)

; How many pages to capture (adjust as needed)
totalPages := 20

; Scroll and screenshot loop
Loop totalPages {
    pageNum := A_Index
    fileName := saveDir . "\page_" . pageNum . ".png"

    ; Take a screenshot of the current viewport
    Send("#+s")  ; Windows + Shift + S (Snipping Tool) -- OR use PrtScn below
    Sleep(2000)

    ; ↓ Alternative (optional): use PrintScreen and save manually
    ; Send("{PrintScreen}")

    ; Scroll down
    Send("{PgDn}")
    Sleep(3000)
}

MsgBox("✅ Done! Screenshots captured in: " . saveDir)

