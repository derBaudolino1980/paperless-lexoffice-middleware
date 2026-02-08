import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Workflows from './pages/Workflows';
import WorkflowNew from './pages/WorkflowNew';
import Connections from './pages/Connections';
import Logs from './pages/Logs';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/workflows/new" element={<WorkflowNew />} />
        <Route path="/connections" element={<Connections />} />
        <Route path="/logs" element={<Logs />} />
      </Routes>
    </Layout>
  );
}

export default App;
