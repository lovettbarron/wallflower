use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::Manager;

/// Set up the system tray icon and menu.
///
/// Creates a tray icon in the macOS menubar with:
/// - Start Recording / Stop Recording toggle
/// - Open Wallflower
/// - Quit Wallflower
pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let start_recording =
        MenuItem::with_id(app, "start_recording", "Start Recording", true, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "Open Wallflower", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Wallflower", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&start_recording, &open, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().unwrap())
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("Wallflower")
        .on_menu_event(|app, event| {
            use tauri::Emitter;

            match event.id().as_ref() {
                "start_recording" => {
                    let state: tauri::State<'_, crate::AppState> = app.state();
                    let status = {
                        let engine = state.recording_engine.lock().unwrap();
                        engine.0.status()
                    };
                    match status {
                        wallflower_core::recording::RecordingState::Idle => {
                            // Start recording via async runtime
                            let handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let state: tauri::State<'_, crate::AppState> = handle.state();
                                match crate::commands::recording::start_recording(
                                    handle.clone(),
                                    state,
                                )
                                .await
                                {
                                    Ok(result) => {
                                        tracing::info!(
                                            "Tray: recording started (jam {})",
                                            result.jam_id
                                        );
                                    }
                                    Err(e) => {
                                        tracing::error!("Tray: failed to start recording: {}", e);
                                    }
                                }
                            });
                        }
                        wallflower_core::recording::RecordingState::Recording => {
                            // Show stop dialog in window
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                            let _ = app.emit("show-stop-dialog", ());
                        }
                        _ => {}
                    }
                }
                "stop_recording" => {
                    // Stop recording via async runtime
                    let handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let state: tauri::State<'_, crate::AppState> = handle.state();
                        match crate::commands::recording::stop_recording(handle.clone(), state)
                            .await
                        {
                            Ok(result) => {
                                tracing::info!(
                                    "Tray: recording stopped (jam {})",
                                    result.jam_id
                                );
                            }
                            Err(e) => {
                                tracing::error!("Tray: failed to stop recording: {}", e);
                            }
                        }
                    });
                }
                "open" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    // If recording, show stop dialog instead of quitting
                    let state: tauri::State<'_, crate::AppState> = app.state();
                    let is_recording = {
                        let engine = state.recording_engine.lock().unwrap();
                        matches!(
                            engine.0.status(),
                            wallflower_core::recording::RecordingState::Recording
                        )
                    };
                    if is_recording {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                        let _ = app.emit("show-stop-dialog", ());
                    } else {
                        app.exit(0);
                    }
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

/// Update the tray menu to reflect the current recording state.
///
/// When recording:
/// - Shows "Recording -- {elapsed}" (disabled info item)
/// - Shows "Stop Recording" action
/// - Shows "Open Wallflower" and "Quit Wallflower"
///
/// When idle:
/// - Shows "Start Recording"
/// - Shows "Open Wallflower" and "Quit Wallflower"
pub fn update_tray_for_recording(
    app: &tauri::AppHandle,
    recording: bool,
    elapsed: Option<String>,
) {
    let tray = match app.tray_by_id("main") {
        Some(tray) => tray,
        None => {
            // Try to get any tray icon
            tracing::debug!("Tray icon 'main' not found, skipping tray update");
            return;
        }
    };

    let result = if recording {
        let elapsed_str = elapsed.unwrap_or_else(|| "00:00".to_string());
        let recording_info = MenuItem::with_id(
            app,
            "recording_info",
            &format!("Recording -- {}", elapsed_str),
            false,
            None::<&str>,
        );
        let stop = MenuItem::with_id(app, "stop_recording", "Stop Recording", true, None::<&str>);
        let open = MenuItem::with_id(app, "open", "Open Wallflower", true, None::<&str>);
        let quit = MenuItem::with_id(app, "quit", "Quit Wallflower", true, None::<&str>);

        match (recording_info, stop, open, quit) {
            (Ok(ri), Ok(s), Ok(o), Ok(q)) => {
                Menu::with_items(app, &[&ri, &s, &o, &q]).and_then(|menu| tray.set_menu(Some(menu)))
            }
            _ => {
                tracing::warn!("Failed to create recording tray menu items");
                return;
            }
        }
    } else {
        let start =
            MenuItem::with_id(app, "start_recording", "Start Recording", true, None::<&str>);
        let open = MenuItem::with_id(app, "open", "Open Wallflower", true, None::<&str>);
        let quit = MenuItem::with_id(app, "quit", "Quit Wallflower", true, None::<&str>);

        match (start, open, quit) {
            (Ok(s), Ok(o), Ok(q)) => {
                Menu::with_items(app, &[&s, &o, &q]).and_then(|menu| tray.set_menu(Some(menu)))
            }
            _ => {
                tracing::warn!("Failed to create idle tray menu items");
                return;
            }
        }
    };

    if let Err(e) = result {
        tracing::warn!("Failed to update tray menu: {}", e);
    }
}
