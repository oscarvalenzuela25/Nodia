import { useState } from "react";
import reactLogo from "./../../../../assets/react.svg";
import viteLogo from "./../../../../assets/vite.svg";
import heroImg from "./../../../../assets/hero.png";
import "./home.css";
import { useTranslation } from "react-i18next";

const Home = () => {
  const { t, i18n } = useTranslation();
  const [count, setCount] = useState(0);
  const currentLanguage = i18n.resolvedLanguage ?? i18n.language;

  const languageOptions = [
    { code: "es", shortLabel: "ES", label: t("translate:es") },
    { code: "en", shortLabel: "EN", label: t("translate:en") },
  ] as const;

  const handleLanguageChange = (language: "es" | "en") => {
    i18n.changeLanguage(language);
  };

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt={t("home:react_logo_alt")} />
          <img src={viteLogo} className="vite" alt={t("home:vite_logo_alt")} />
        </div>
        <div>
          <h1>{t("home:title")}</h1>
        </div>
        <button
          className="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          {t("home:counter", { counter: count })}
        </button>
        <div
          style={{
            width: "min(420px, calc(100% - 2rem))",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "var(--text-h)",
              fontSize: "13px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            {t("home:language_label")}
          </p>
          <div
            style={{
              width: "100%",
              background:
                "linear-gradient(130deg, var(--accent-bg), rgba(255, 255, 255, 0.02))",
              border: "1px solid var(--accent-border)",
              borderRadius: "18px",
              padding: "7px",
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "8px",
              boxShadow: "var(--shadow)",
              backdropFilter: "blur(6px)",
            }}
          >
            {languageOptions.map(({ code, shortLabel, label }) => {
              const active = currentLanguage === code;

              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleLanguageChange(code)}
                  style={{
                    borderRadius: "12px",
                    border: active
                      ? "1px solid color-mix(in srgb, var(--accent) 60%, white 40%)"
                      : "1px solid var(--border)",
                    background: active
                      ? "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 72%, black 28%))"
                      : "var(--bg)",
                    color: active ? "#fff" : "var(--text-h)",
                    padding: "11px 12px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    transition: "all 180ms ease",
                    boxShadow: active
                      ? "0 8px 22px rgba(170, 59, 255, 0.35)"
                      : "0 2px 8px rgba(0, 0, 0, 0.08)",
                    transform: active ? "translateY(-1px)" : "translateY(0)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      letterSpacing: "0.09em",
                      opacity: active ? 0.95 : 0.7,
                    }}
                  >
                    {shortLabel}
                  </span>
                  <span style={{ textTransform: "capitalize" }}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="ticks"></div>

      <div className="ticks"></div>
    </>
  );
};

export default Home;
