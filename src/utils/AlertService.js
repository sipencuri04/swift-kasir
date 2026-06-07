import Swal from 'sweetalert2';

export const AlertService = {
    success: (title, text = '', html = '') => {
        return Swal.fire({
            title,
            text: html ? undefined : text,
            html,
            icon: 'success',
            confirmButtonColor: '#00b4d8',
            confirmButtonText: 'Selesai',
            background: 'var(--card-bg)',
            color: 'var(--text-main)',
            customClass: {
                popup: 'modern-alert-popup'
            }
        });
    },
    error: (title, text = '') => {
        return Swal.fire({
            title,
            text,
            icon: 'error',
            confirmButtonColor: '#00b4d8',
            confirmButtonText: 'OK',
            background: 'var(--card-bg)',
            color: 'var(--text-main)',
            customClass: {
                popup: 'modern-alert-popup'
            }
        });
    },
    info: (title, text = '', html = '') => {
        return Swal.fire({
            title,
            text: html ? undefined : text,
            html,
            icon: 'info',
            confirmButtonColor: '#00b4d8',
            confirmButtonText: 'OK',
            background: 'var(--card-bg)',
            color: 'var(--text-main)',
            customClass: {
                popup: 'modern-alert-popup'
            }
        });
    },
    confirm: async (title, text = '') => {
        const result = await Swal.fire({
            title,
            text,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#00b4d8',
            cancelButtonColor: '#ef4444',
            confirmButtonText: 'Ya, Lanjutkan',
            cancelButtonText: 'Batal',
            background: 'var(--card-bg)',
            color: 'var(--text-main)',
            customClass: {
                popup: 'modern-alert-popup'
            }
        });
        return result.isConfirmed;
    }
};
