import type { FC, PropsWithChildren } from "react";

type Props = PropsWithChildren;

const BaseLayout: FC<Props> = ({ children }) => {
  return <>{children}</>;
};

export default BaseLayout;
