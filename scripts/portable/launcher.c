/*
 * RisuAI NodeOnly — Windows portable launcher
 * Compiled with: gcc -municode -O2 -o RisuAI.exe launcher.c launcher.res -lshell32
 * Note: -municode already defines UNICODE and _UNICODE
 */
#include <windows.h>
#include <shellapi.h>
#include <stdio.h>
#include <stdlib.h>

int wmain(void) {
    WCHAR dir[MAX_PATH], buf[MAX_PATH], cmd[MAX_PATH * 3], port[16];

    /* Determine portable root (directory containing this exe) */
    GetModuleFileNameW(NULL, dir, MAX_PATH);
    WCHAR *sep = wcsrchr(dir, L'\\');
    if (sep) *sep = L'\0';

    SetConsoleTitleW(L"RisuAI NodeOnly");
    SetCurrentDirectoryW(dir);

    /* PORT: honour existing env var, default to 6001 */
    if (!GetEnvironmentVariableW(L"PORT", port, 16))
        wcscpy(port, L"6001");
    SetEnvironmentVariableW(L"PORT", port);

    /* Verify bin\node.exe exists */
    wsprintfW(buf, L"%s\\bin\\node.exe", dir);
    if (GetFileAttributesW(buf) == INVALID_FILE_ATTRIBUTES) {
        wprintf(L"[Error] bin\\node.exe not found.\n");
        system("pause");
        return 1;
    }

    /* Open default browser */
    wsprintfW(buf, L"http://localhost:%s", port);
    ShellExecuteW(NULL, L"open", buf, NULL, NULL, SW_SHOWNORMAL);

    /* Launch: bin\node.exe server\node\server.cjs */
    wsprintfW(cmd, L"\"%s\\bin\\node.exe\" \"%s\\server\\node\\server.cjs\"",
              dir, dir);

    STARTUPINFOW si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    ZeroMemory(&pi, sizeof(pi));

    if (!CreateProcessW(NULL, cmd, NULL, NULL, TRUE, 0, NULL, dir, &si, &pi)) {
        wprintf(L"[Error] Failed to start server (error %lu).\n",
                GetLastError());
        system("pause");
        return 1;
    }

    WaitForSingleObject(pi.hProcess, INFINITE);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);

    system("pause");
    return 0;
}
