import React from 'react';
import { openConsent } from '../components/consentBus';
import { useNavigate } from "react-router-dom";
import { getLocalSnapshot, readJSON } from '../utils/storageUtils';

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const INPUT_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'mobile', label: 'Scroller' },
  { value: 'desktop', label: 'Keyboard' },
];

const TEXT_SIZE_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
];

const MAP_STYLE_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'contrast', label: 'High Contrast' },
  { value: 'night', label: 'Night' },
];

const ONBOARDING_KEY = 'pp:onboardingComplete:v1';

export default function Settings({
  onBack,
  uiTheme,
  onUiThemeChange,
  colorblindFriendly,
  onColorblindFriendlyChange,
  inputMode,
  onInputModeChange,
  largeControls,
  onLargeControlsChange,
  mapStyle,
  onMapStyleChange,
  textSize,
  onTextSizeChange,
}) {
  const navigate = useNavigate();
  const hasConsented = !!localStorage.getItem('pp_consents');
  const stored = hasConsented ? readJSON('pp_consents', null) : null;
  const [localTheme, setLocalTheme] = React.useState(() => uiTheme || 'system');
  const [localColorblind, setLocalColorblind] = React.useState(() => !!colorblindFriendly);
  const [localInputMode, setLocalInputMode] = React.useState(() => inputMode || 'auto');
  const [localLargeControls, setLocalLargeControls] = React.useState(() => !!largeControls);
  const [localMapStyle, setLocalMapStyle] = React.useState(() => mapStyle || 'standard');
  const [localTextSize, setLocalTextSize] = React.useState(() => textSize || 'normal');

  React.useEffect(() => {
    if (uiTheme) setLocalTheme(uiTheme);
  }, [uiTheme]);

  React.useEffect(() => {
    setLocalColorblind(!!colorblindFriendly);
  }, [colorblindFriendly]);

  React.useEffect(() => {
    if (inputMode) setLocalInputMode(inputMode);
  }, [inputMode]);
  React.useEffect(() => {
    setLocalLargeControls(!!largeControls);
  }, [largeControls]);
  React.useEffect(() => {
    if (mapStyle) setLocalMapStyle(mapStyle);
  }, [mapStyle]);
  React.useEffect(() => {
    if (textSize) setLocalTextSize(textSize);
  }, [textSize]);

  const selectedTheme = uiTheme || localTheme;
  const selectedColorblind = colorblindFriendly ?? localColorblind;
  const selectedInputMode = inputMode || localInputMode;
  const selectedLargeControls = largeControls ?? localLargeControls;
  const selectedMapStyle = mapStyle || localMapStyle;
  const selectedTextSize = textSize || localTextSize;

  const handleThemeChange = (value) => {
    setLocalTheme(value);
    onUiThemeChange?.(value);
  };

  const handleColorblindChange = (value) => {
    setLocalColorblind(value);
    onColorblindFriendlyChange?.(value);
  };

  const handleInputModeChange = (value) => {
    setLocalInputMode(value);
    onInputModeChange?.(value);
  };

  const handleLargeControlsChange = (value) => {
    setLocalLargeControls(value);
    onLargeControlsChange?.(value);
  };

  const handleMapStyleChange = (value) => {
    setLocalMapStyle(value);
    onMapStyleChange?.(value);
  };

  const handleTextSizeChange = (value) => {
    setLocalTextSize(value);
    onTextSizeChange?.(value);
  };

  const handleExportProgress = () => {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      app: 'Postcode Pursuit',
      schema: 'pp-progress-export-v1',
      progress: getLocalSnapshot(),
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `postcode-pursuit-progress-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleResetTutorial = () => {
    localStorage.removeItem(ONBOARDING_KEY);
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
        <h2 className="text-lg font-semibold">Input</h2>
        <p className="mt-2">
          Choose the postcode entry controls for this device.
        </p>

        <div className="pp-settings-segmented mt-4" role="radiogroup" aria-label="Input style">
          {INPUT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selectedInputMode === option.value}
              className={selectedInputMode === option.value ? 'is-active' : ''}
              onClick={() => handleInputModeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="glass pp-settings-section p-4 rounded-xl mb-6">
        <h2 className="text-lg font-semibold">Accessibility</h2>
        <p className="mt-2">
          Adjust controls and readability on this device.
        </p>

        <div className="pp-settings-segmented mt-4 pp-settings-segmented--two" role="radiogroup" aria-label="Text size">
          {TEXT_SIZE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selectedTextSize === option.value}
              className={selectedTextSize === option.value ? 'is-active' : ''}
              onClick={() => handleTextSizeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="pp-settings-toggle mt-5">
          <input
            type="checkbox"
            checked={selectedLargeControls}
            onChange={(event) => handleLargeControlsChange(event.target.checked)}
          />
          <span>
            <strong>Large controls</strong>
            <small>Makes buttons and touch targets roomier.</small>
          </span>
        </label>

        <div className="mt-5">
          <h3 className="font-semibold">Map style</h3>
          <div className="pp-settings-segmented mt-3" role="radiogroup" aria-label="Map style">
            {MAP_STYLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selectedMapStyle === option.value}
                className={selectedMapStyle === option.value ? 'is-active' : ''}
                onClick={() => handleMapStyleChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="glass pp-settings-section p-4 rounded-xl mb-6">
        <h2 className="text-lg font-semibold">Stats & Data</h2>
        <p className="mt-2">
          Export progress or revisit the tutorial.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={handleExportProgress}>
            Export progress
          </button>
          <button className="btn btn-neutral" onClick={handleResetTutorial}>
            Reset tutorial
          </button>
        </div>
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
