import TeacherWorkspace from '../components/dashboard/TeacherWorkspace';
import { currentUser } from '../mocks/initialData';

export default function TeacherDashboard() {
  return <TeacherWorkspace teacher={currentUser} />;
}
