import { Navigate } from 'react-router-dom';

// This page is no longer used, redirect to root
const Index = () => {
  return <Navigate to="/" replace />;
};

export default Index;
