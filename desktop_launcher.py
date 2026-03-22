import contextlib
import os
import socket
import sys
import threading
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import tkinter as tk
from tkinter import messagebox


if getattr(sys, "frozen", False):
    ROOT = Path(getattr(sys, "_MEIPASS", Path(sys.executable).resolve().parent))
else:
    ROOT = Path(__file__).resolve().parent


def find_free_port(start=4173, end=4200):
    for port in range(start, end + 1):
        with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
            if sock.connect_ex(("127.0.0.1", port)) != 0:
                return port
    raise RuntimeError("Не удалось найти свободный порт в диапазоне 4173-4200.")


class DesktopLauncher:
    def __init__(self):
        self.server = None
        self.thread = None
        self.port = find_free_port()
        self.url = f"http://127.0.0.1:{self.port}/"

        self.root = tk.Tk()
        self.root.title("PSYVIT YBT Launcher")
        self.root.geometry("520x340")
        self.root.minsize(520, 340)
        self.root.configure(bg="#f4efe6")
        self.root.protocol("WM_DELETE_WINDOW", self.close)

        self.status_var = tk.StringVar(value="Готов к запуску.")
        self.url_var = tk.StringVar(value=self.url)

        self.build_ui()

    def build_ui(self):
        frame = tk.Frame(self.root, bg="#f4efe6", padx=28, pady=24)
        frame.pack(fill="both", expand=True)

        title = tk.Label(
            frame,
            text="PSYVIT / YBT Desktop",
            font=("Segoe UI", 22, "bold"),
            bg="#f4efe6",
            fg="#1d2430",
        )
        title.pack(anchor="w")

        subtitle = tk.Label(
            frame,
            text="Локальный launcher для web-app версии. Поднимает встроенный HTTP-сервер и открывает тренажёр в браузере.",
            wraplength=450,
            justify="left",
            font=("Segoe UI", 10),
            bg="#f4efe6",
            fg="#5f6a78",
        )
        subtitle.pack(anchor="w", pady=(10, 18))

        url_label = tk.Label(
            frame,
            textvariable=self.url_var,
            font=("Consolas", 11),
            bg="#fffaf2",
            fg="#274c77",
            padx=12,
            pady=10,
            relief="groove",
            borderwidth=1,
        )
        url_label.pack(fill="x")

        btn_row = tk.Frame(frame, bg="#f4efe6")
        btn_row.pack(fill="x", pady=(18, 12))

        self.start_btn = tk.Button(
            btn_row,
            text="Запустить приложение",
            command=self.start_and_open,
            bg="#b44c2f",
            fg="white",
            activebackground="#d56d41",
            activeforeground="white",
            relief="flat",
            padx=14,
            pady=10,
        )
        self.start_btn.pack(side="left")

        self.open_btn = tk.Button(
            btn_row,
            text="Открыть в браузере",
            command=self.open_browser,
            bg="#274c77",
            fg="white",
            activebackground="#456b98",
            activeforeground="white",
            relief="flat",
            padx=14,
            pady=10,
        )
        self.open_btn.pack(side="left", padx=(10, 0))

        self.stop_btn = tk.Button(
            btn_row,
            text="Остановить сервер",
            command=self.stop_server,
            bg="#e4ddd1",
            fg="#1d2430",
            activebackground="#d8cfbf",
            relief="flat",
            padx=14,
            pady=10,
        )
        self.stop_btn.pack(side="left", padx=(10, 0))

        notes = [
            "Web-app: можно установить из браузера через «Установить приложение».",
            "Desktop: launcher не требует Node/Electron и работает на стандартном Python.",
            "Контент берётся из data/manifest.json и data/scenarios/*.json.",
        ]

        for note in notes:
            label = tk.Label(
                frame,
                text=f"• {note}",
                wraplength=450,
                justify="left",
                font=("Segoe UI", 10),
                bg="#f4efe6",
                fg="#1d2430",
            )
            label.pack(anchor="w", pady=2)

        status = tk.Label(
            frame,
            textvariable=self.status_var,
            wraplength=450,
            justify="left",
            font=("Segoe UI", 10),
            bg="#f4efe6",
            fg="#5f6a78",
        )
        status.pack(anchor="w", pady=(20, 0))

    def start_server(self):
        if self.server:
            return

        handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
        self.server = ThreadingHTTPServer(("127.0.0.1", self.port), handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.status_var.set(f"Сервер запущен: {self.url}")

    def stop_server(self):
        if not self.server:
            self.status_var.set("Сервер уже остановлен.")
            return

        self.server.shutdown()
        self.server.server_close()
        self.server = None
        self.thread = None
        self.status_var.set("Сервер остановлен.")

    def open_browser(self):
        try:
            if not self.server:
                self.start_server()
            webbrowser.open(self.url)
            self.status_var.set(f"Открыл браузер: {self.url}")
        except Exception as exc:
            messagebox.showerror("Ошибка запуска", str(exc))

    def start_and_open(self):
        self.start_server()
        self.open_browser()

    def close(self):
        self.stop_server()
        self.root.destroy()

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    os.chdir(ROOT)
    DesktopLauncher().run()
