import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { API } from '@/services/Api';
import { toast } from 'sonner';

const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const [status, setStatus] = useState('Verifying your email...');

    useEffect(() => {
        const verify = async () => {
             if (!token) {
                 setStatus('Invalid verification link.');
                 return;
             }
             try {
                 await API.get({
                     slug: '/auth/verify',
                     queryParameters: { token }
                 });
                 setStatus('Email verified successfully! You will be redirected to login shortly.');
                 toast.success('Email verified successfully');
                 setTimeout(() => navigate('/signin'), 3000);
             } catch (error) {
                 setStatus('Verification failed. The link may be invalid or expired.');
                 toast.error('Verification failed');
             }
        };
        verify();
    }, [token, navigate]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
             <div className="bg-white p-8 rounded-lg shadow-md text-center">
                <h1 className="text-2xl font-bold mb-4">Email Verification</h1>
                <p className="text-gray-600">{status}</p>
             </div>
        </div>
    );
};
export default VerifyEmail;
