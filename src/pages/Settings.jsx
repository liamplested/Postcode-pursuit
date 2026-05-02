import React from 'react';
import { openConsent } from '../components/consentBus';
import { useNavigate } from "react-router-dom";

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function Settings({
  onBack,
  uiTheme,
  onUiThemeChange,
  colorblindFriendly,
  onColorblindFriendlyChange,
}) {
  const navigate = useNavigate();
  const hasConsented = !!localStorage.getItem('pp_consents');
  const stored = hasConsented ? JSON.parse(localStorage.getItem('pp_consents')) : null;
  const [localTheme, setLocalTheme] = React.useState(() => uiTheme || 'system');
  const [localColorblind, setLocalColorblind] = React.useState(() => !!colorblindFriendly);

  React.useEffect(() => {
    if (uiTheme) setLocalTheme(uiTheme);
  }, [uiTheme]);

  React.useEffect(() => {
    setLocalColorblind(!!colorblindFriendly);
  }, [colorblindFriendly]);

  const selectedTheme = uiTheme || localTheme;
  const selectedColorblind = colorblindFriendly ?? localColorblind;

  const handleThemeChange = (value) => {
    setLocalTheme(value);
    onUiThemeChange?.(value);
  };

  const handleColorblindChange = (value) => {
    setLocalColorblind(value);
    onColorblindFriendlyChange?.(value);
  };

  const handleBack = () => {
    if (onBack) onBack();
    else navigate("/", { replace: true });
  };

  const handlePrivacy = () => {
    if (onBack) {
      window.location.hash = "#/privacy";
    } else {
      navigate("/privacy");
    }
  };

  return (
    <div className="pp-settings-page max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>

      <section className="glass pp-settings-section p-4 rounded-xl mb-6">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="mt-2">
          Choose how Postcode Pursuit should look on this device.
        </p>

        <div className="pp-settings-segmented mt-4" role="radiogroup" aria-label="Colour theme">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selectedTheme === option.value}
              className={selectedTheme === option.value ? 'is-active' : ''}
              onClick={() => handleThemeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="pp-settings-toggle mt-5">
          <input
            type="checkbox"
            checked={selectedColorblind}
            onChange={(event) => handleColorblindChange(event.target.checked)}
          />
          <span>
            <strong>Colour-blind friendly colours</strong>
            <small>Uses a blue, orange and teal palette for key game states.</small>
          </span>
        </label>
      </section>

      <section className="glass pp-settings-section p-4 rounded-xl mb-6">
        <h2 className="text-lg font-semibold">Cookies & Privacy</h2>
        <p className="mt-2">
          Manage your cookie choices for Postcode Pursuit.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={openConsent}>
            Manage cookies
          </button>
          <button className="btn btn-purple" onClick={handlePrivacy}>
            Privacy Policy
          </button>
          <button onClick={handleBack} className="btn btn-primary">
            Return to Menu
          </button>
          <a
            href="https://forms.gle/Hf6fgRzBSnnZCqYJ6"
            className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
          >
            Send feedback
          </a>
        </div>

        {stored && (
          <div className="mt-4 text-sm pp-settings-consent">
            <div><b>Last choice:</b> {new Date(stored.timestamp).toLocaleString()}</div>
            <div><b>Analytics:</b> {stored.choices?.analytics ? 'Allowed' : 'Rejected'}</div>
          </div>
        )}
      </section>
    </div>
  );
}