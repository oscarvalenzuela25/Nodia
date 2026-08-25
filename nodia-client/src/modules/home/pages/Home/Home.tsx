import reactLogo from "./../../../../assets/react.svg";
import viteLogo from "./../../../../assets/vite.svg";
import heroImg from "./../../../../assets/hero.png";
import useHome from "./hooks/useHome";
import {
  BaseImage,
  CounterButton,
  FrameworkImage,
  Hero,
  LanguageButton,
  LanguageLabel,
  LanguagePanel,
  LanguageSection,
  LanguageShortLabel,
  LanguageText,
  Page,
  Tick,
  Title,
  ViteImage,
} from "./styles";

const Home = () => {
  const {
    count,
    currentLanguage,
    handleIncrement,
    handleLanguageChange,
    languageOptions,
    t,
  } = useHome();

  return (
    <>
      <Page>
        <Hero>
          <BaseImage src={heroImg} width="170" height="179" alt="" />
          <FrameworkImage src={reactLogo} alt={t("home:react_logo_alt")} />
          <ViteImage src={viteLogo} alt={t("home:vite_logo_alt")} />
        </Hero>
        <Title>{t("home:title")}</Title>
        <CounterButton type="button" onClick={handleIncrement}>
          {t("home:counter", { counter: count })}
        </CounterButton>
        <LanguageSection>
          <LanguageLabel id="language-selector-label">
            {t("home:language_label")}
          </LanguageLabel>
          <LanguagePanel role="group" aria-labelledby="language-selector-label">
            {languageOptions.map(({ code, shortLabel, label }) => {
              const active = currentLanguage === code;

              return (
                <LanguageButton
                  key={code}
                  type="button"
                  aria-label={label}
                  aria-pressed={active}
                  onClick={() => handleLanguageChange(code)}
                >
                  <LanguageShortLabel>{shortLabel}</LanguageShortLabel>
                  <LanguageText>{label}</LanguageText>
                </LanguageButton>
              );
            })}
          </LanguagePanel>
        </LanguageSection>
      </Page>

      <Tick aria-hidden="true" />
      <Tick aria-hidden="true" />
    </>
  );
};

export default Home;
