import { Outlet } from 'react-router-dom';
import { TopNavbar } from '../components/navbar';
import { Footer } from '../components/footer';

export function PublicLayout() {
  return (
    <>
      <Outlet />
      <Footer />
    </>
  );
}