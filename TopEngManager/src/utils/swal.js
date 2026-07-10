// SweetAlert2 Lazy Loading Utility to reduce initial bundle size
export async function getSwal() {
  const Swal = (await import('sweetalert2')).default;
  return Swal;
}
