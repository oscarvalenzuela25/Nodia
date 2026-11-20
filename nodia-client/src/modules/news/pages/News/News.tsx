import useAuth from "../../../../hooks/useAuth";
import PersonalNews from "../../components/PersonalNews";

export default function News() {
  const { user, sessionVersion } = useAuth();
  if (!user?.id) return null;

  const actorKey = `${user.id}:${sessionVersion}`;
  return <PersonalNews key={actorKey} actorKey={actorKey} />;
}
