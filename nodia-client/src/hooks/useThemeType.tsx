import useConfigStore from "../store/configStore";

const useThemeType = () => {
  const themeType = useConfigStore((state) => state.themeType);
  const handleChangeThemeType = useConfigStore(
    (state) => state.handleChangeThemeType
  );
  const handleToggleThemeType = useConfigStore(
    (state) => state.handleToggleThemeType
  );

  return { themeType, handleChangeThemeType, handleToggleThemeType };
};

export default useThemeType;
