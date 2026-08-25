import Grid from "@mui/material/Grid";
import useHome from "./hooks/useHome";
import {
  ContainerPage,
  WelcomeMessage,
  SectionTitle,
  SettingsCard,
  CardTitle,
  CardDescription,
} from "./styles";

const SETTINGS_MODULES = [
  {
    path: "/settings/users",
    titleKey: "home:users_title",
    descKey: "home:users_desc",
  },
  {
    path: "/settings/roles",
    titleKey: "home:roles_title",
    descKey: "home:roles_desc",
  },
  {
    path: "/settings/modules",
    titleKey: "home:modules_title",
    descKey: "home:modules_desc",
  },
  {
    path: "/settings/resources",
    titleKey: "home:resources_title",
    descKey: "home:resources_desc",
  },
];

const Home = () => {
  const { t } = useHome();

  return (
    <ContainerPage>
      <WelcomeMessage>{t("home:welcome")}</WelcomeMessage>

      <SectionTitle>{t("home:general_settings")}</SectionTitle>

      <Grid container spacing={3}>
        {SETTINGS_MODULES.map((module) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={module.path}>
            <SettingsCard to={module.path}>
              <CardTitle>{t(module.titleKey)}</CardTitle>
              <CardDescription>{t(module.descKey)}</CardDescription>
            </SettingsCard>
          </Grid>
        ))}
      </Grid>
    </ContainerPage>
  );
};

export default Home;
