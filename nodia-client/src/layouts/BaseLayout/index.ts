import BaseLayout from "./BaseLayout";
import withAuthorizationContext from "../../hocs/withAuthorizationContext";

export const BaseLayoutWrapped = withAuthorizationContext(BaseLayout);
export { BaseLayout };
export default BaseLayoutWrapped;
