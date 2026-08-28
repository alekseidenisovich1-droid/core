use serde::Serialize;
use sysinfo::{ProcessesToUpdate, System};
use tauri::Emitter;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ActivityPayload {
    codex_cpu: f32,
    vscode_cpu: f32,
    active: bool,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut system = System::new_all();
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(750));
                    system.refresh_processes(ProcessesToUpdate::All, true);
                    let mut codex_cpu = 0.0;
                    let mut vscode_cpu = 0.0;
                    for process in system.processes().values() {
                        let name = process.name().to_string_lossy().to_ascii_lowercase();
                        if name == "codex.exe" || name == "codex" || name.contains("codex-code-mode-host") {
                            codex_cpu += process.cpu_usage();
                        } else if name == "code.exe" || name == "code" {
                            vscode_cpu += process.cpu_usage();
                        }
                    }
                    let _ = handle.emit("core-activity", ActivityPayload {
                        codex_cpu,
                        vscode_cpu,
                        active: codex_cpu > 1.2,
                    });
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running CORE");
}
