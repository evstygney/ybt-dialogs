# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path


ROOT = Path.cwd()

datas = [
    (str(ROOT / "index.html"), "."),
    (str(ROOT / "styles.css"), "."),
    (str(ROOT / "app.js"), "."),
    (str(ROOT / "site.webmanifest"), "."),
    (str(ROOT / "service-worker.js"), "."),
    (str(ROOT / "assets"), "assets"),
    (str(ROOT / "data"), "data"),
]


a = Analysis(
    ["desktop_launcher.py"],
    pathex=[str(ROOT)],
    binaries=[],
    datas=datas,
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="PSYVIT_YBT_Desktop",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(ROOT / "assets" / "icon.ico") if (ROOT / "assets" / "icon.ico").exists() else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="PSYVIT_YBT_Desktop",
)
