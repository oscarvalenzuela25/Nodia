import type { FC } from "react";
import Grid from "@mui/material/Grid";
import { Alert, Box, Button, Typography } from "@mui/material";
import useHome from "./hooks/useHome";
import {
  ContainerPage,
  WelcomeMessage,
  SectionTitle,
  SettingsCard,
  CardTitle,
  CardDescription,
} from "./styles";

const Home: FC = () => {
  const {
    t,
    userModules,
    isError,
    errorMessage,
    refetchAuthContext,
    getGroupTitle,
    getModuleTitle,
    getModuleDesc,
    getModulePath,
  } = useHome();

  return (
    <ContainerPage>
      <WelcomeMessage sx={{ mb: isError ? 3 : 6 }}>
        {t("home:welcome")}
      </WelcomeMessage>

      {isError && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                void refetchAuthContext();
              }}
            >
              {t("core:retry")}
            </Button>
          }
          sx={{ mb: 4 }}
          data-testid="home-auth-error"
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {t("core:auth_context_error_title")}
          </Typography>
          <Typography variant="body2">
            {errorMessage || t("core:auth_context_error_message")}
          </Typography>
        </Alert>
      )}

      {userModules && userModules.length > 0 ? (
        userModules.map((group) => {
          const groupTitle = getGroupTitle(group);
          const modules = group.modules ?? [];
          if (modules.length === 0) return null;

          return (
            <Box key={group.module_group_key} sx={{ mb: 4 }}>
              <SectionTitle>{groupTitle}</SectionTitle>
              <Grid container spacing={3}>
                {modules.map((m) => {
                  const title = getModuleTitle(m);
                  const desc = getModuleDesc(m);
                  const path = getModulePath(m);

                  return (
                    <Grid size={{ xs: 12, sm: 6, md: 3 }} key={m.key}>
                      <SettingsCard to={path}>
                        <CardTitle>{title}</CardTitle>
                        <CardDescription>{desc}</CardDescription>
                      </SettingsCard>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          );
        })
      ) : (
        !isError && (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              {t("home:no_modules_title")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("home:no_modules_desc")}
            </Typography>
          </Box>
        )
      )}
    </ContainerPage>
  );
};

export default Home;
