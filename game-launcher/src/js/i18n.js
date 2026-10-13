export const TRANSLATIONS = {
  vi: {
    brand_title: 'Trò chơi',
    nav_library: 'Thư viện',
    nav_library_title: 'Xem thư viện trò chơi',
    nav_settings: 'Cài đặt',
    nav_settings_title: 'Mở cài đặt & bộ nhớ trò chơi',
    library_title: 'Thư viện trò chơi',
    library_desc: 'Chọn bất kỳ trò chơi nào bên dưới để chơi hoặc tải về. Các nút bấm lớn giúp thao tác dễ dàng.',
    no_games_catalog: 'Không có trò chơi nào trong danh mục.',
    badge_update: 'Có bản cập nhật',
    badge_ready: 'Đã tải',
    badge_new: 'Chưa tải',
    btn_update: 'Cập nhật & Chơi',
    btn_play: 'Chơi ngay',
    btn_download: 'Tải & Chơi',
    downloading: 'Đang tải {percent}%',
    processing: 'Đang xử lý...',
    download_failed: 'Tải xuống thất bại: ',
    launch_failed: 'Khởi chạy thất bại: ',
    settings_title: 'Cài đặt trình khởi chạy',
    settings_desc: 'Quản lý cập nhật và bộ nhớ trò chơi cục bộ bên dưới.',
    global_preferences: 'Tùy chọn chung',
    language_label: 'Ngôn ngữ',
    auto_update_all: 'Tự động cập nhật tất cả trò chơi không cần hỏi',
    storage_management: 'Trò chơi đã cài & Quản lý bộ nhớ',
    btn_remove_all: 'Xóa tất cả',
    btn_remove_all_title: 'Xóa tất cả trò chơi đã cài',
    auto_update: 'Tự động cập nhật',
    installed_status: 'Đã cài: v{installed} | Bản mới: v{target}',
    not_installed_status: 'Chưa cài (Mới nhất: v{version})',
    btn_predownload: 'Tải trước',
    btn_predownloading: 'Đang tải...',
    btn_update_action: 'Cập nhật',
    btn_updating: 'Đang cập nhật...',
    btn_redownload: 'Tải lại',
    btn_redownloading: 'Đang tải lại...',
    btn_remove: 'Xóa',
    confirm_remove: 'Xóa {name} khỏi bộ nhớ máy?',
    confirm_remove_all: 'Xóa tất cả trò chơi khỏi bộ nhớ máy?',
    no_games_settings: 'Không tìm thấy trò chơi nào trong danh mục.',
    btn_exit_game: '← Thoát trò chơi (Về thư viện)',
    btn_exit_game_title: 'Thoát trò chơi và quay lại thư viện',
    modal_updates_title: 'Có bản cập nhật mới',
    modal_updates_subtitle: 'Phiên bản mới đã sẵn sàng cho các trò chơi đã cài. Chọn trò chơi cần cập nhật:',
    chk_dont_ask: 'Không hỏi lại nữa (luôn tự động cập nhật trong tương lai)',
    btn_skip_updates: 'Để sau',
    btn_skip_updates_title: 'Bỏ qua cập nhật lúc này',
    btn_update_selected: 'Cập nhật mục đã chọn',
    btn_update_selected_title: 'Cập nhật các trò chơi đã chọn',
    btn_update_all: 'Cập nhật tất cả ngay',
    btn_update_all_title: 'Cập nhật tất cả trò chơi ngay bây giờ',
    installed_label: 'Đã cài'
  },
  en: {
    brand_title: 'Games',
    nav_library: 'Library',
    nav_library_title: 'View Game Library',
    nav_settings: 'Settings',
    nav_settings_title: 'Open Settings & Game Storage',
    library_title: 'Game Library',
    library_desc: 'Select any game below to play or download. Large buttons are provided for easy clicking.',
    no_games_catalog: 'No games available in catalog.',
    badge_update: 'Update Available',
    badge_ready: 'Installed',
    badge_new: 'Not Installed',
    btn_update: 'Update & Play Game',
    btn_play: 'Play Game',
    btn_download: 'Download & Play Game',
    downloading: 'Downloading {percent}%',
    processing: 'Processing...',
    download_failed: 'Download failed: ',
    launch_failed: 'Launch failed: ',
    settings_title: 'Launcher Settings',
    settings_desc: 'Manage updates and local game storage below.',
    global_preferences: 'Global Preferences',
    language_label: 'Language',
    auto_update_all: 'Automatically update all games without prompting',
    storage_management: 'Installed Games & Cache Management',
    btn_remove_all: 'Remove All',
    btn_remove_all_title: 'Remove All Games',
    auto_update: 'Auto-update',
    installed_status: 'Installed: v{installed} | Target: v{target}',
    not_installed_status: 'Not installed (Latest: v{version})',
    btn_predownload: 'Pre-download Game',
    btn_predownloading: 'Downloading Game...',
    btn_update_action: 'Update Game',
    btn_updating: 'Updating Game...',
    btn_redownload: 'Redownload Game',
    btn_redownloading: 'Redownloading Game...',
    btn_remove: 'Remove Game',
    confirm_remove: 'Remove {name} from local storage?',
    confirm_remove_all: 'Remove all games from local storage?',
    no_games_settings: 'No games found in catalog.',
    btn_exit_game: '← Exit Game (Back to Library)',
    btn_exit_game_title: 'Exit Game and Return to Library',
    modal_updates_title: 'Updates Available',
    modal_updates_subtitle: 'New versions are ready for your installed games. Select which ones to update:',
    chk_dont_ask: "Don't ask again (always auto-update games in the future)",
    btn_skip_updates: 'Skip Updates for Now',
    btn_skip_updates_title: 'Skip Updates for Now',
    btn_update_selected: 'Update Selected Games',
    btn_update_selected_title: 'Update Selected Games',
    btn_update_all: 'Update All Games Now',
    btn_update_all_title: 'Update All Games Now',
    installed_label: 'Installed'
  }
};

export function t(key, lang = 'vi', params = {}) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.vi;
  let text = dict[key] || TRANSLATIONS.vi[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replaceAll(`{${k}}`, v);
  }
  return text;
}

export function applyI18n(lang = 'vi') {
  if (typeof document === 'undefined') return;
  if (document.documentElement) document.documentElement.lang = lang;
  if (typeof document.querySelectorAll !== 'function') return;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key, lang);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.title = t(key, lang);
  });
}
