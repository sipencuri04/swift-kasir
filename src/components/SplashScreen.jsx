import React, { useEffect, useState } from 'react';
import SwiftLogo from '../assets/Swift_Kasir.png';

const SplashScreen = ({ onFinish }) => {
    const [fade, setFade] = useState(false);

    useEffect(() => {
        // Start fade out after 2.5 seconds
        const timer1 = setTimeout(() => {
            setFade(true);
        }, 2200);

        // Notify parent to unmount after 3 seconds (animation complete)
        const timer2 = setTimeout(() => {
            onFinish();
        }, 2500);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [onFinish]);

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, var(--bg-color) 0%, #e0f2fe 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: fade ? 0 : 1
        }}>
            {/* Dark mode gradient adjustment */}
            <style>{`
                [data-theme='dark'] .splash-container {
                    background: linear-gradient(135deg, var(--bg-color) 0%, #0c4a6e 100%) !important;
                }
                .logo-container {
                    animation: float 3s ease-in-out infinite;
                    position: relative;
                }
                .logo-container::after {
                    content: '';
                    position: absolute;
                    bottom: -20px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 60%;
                    height: 10px;
                    background: rgba(0,0,0,0.1);
                    border-radius: 50%;
                    filter: blur(4px);
                    animation: shadow 3s ease-in-out infinite;
                }
                .logo-img {
                    width: 140px;
                    height: 140px;
                    object-fit: contain;
                    /* Clip ugly black corners from the original image */
                    border-radius: 32px; 
                    box-shadow: 0 20px 40px -10px rgba(0, 180, 216, 0.4);
                    background: white;
                    border: 4px solid white;
                }
                .loading-track {
                    width: 120px;
                    height: 4px;
                    background: rgba(0, 180, 216, 0.2);
                    border-radius: 4px;
                    margin-top: 40px;
                    overflow: hidden;
                }
                .loading-bar {
                    width: 40%;
                    height: 100%;
                    background: var(--primary);
                    border-radius: 4px;
                    animation: slide 1.5s ease-in-out infinite;
                }
                .brand-text {
                    margin-top: 24px;
                    font-size: 24px;
                    font-weight: 800;
                    letter-spacing: 1px;
                    background: linear-gradient(to right, var(--primary), var(--secondary));
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    opacity: 0;
                    animation: fadeInUp 0.6s ease-out forwards 0.3s;
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-15px); }
                }
                @keyframes shadow {
                    0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.5; }
                    50% { transform: translateX(-50%) scale(0.8); opacity: 0.2; }
                }
                @keyframes slide {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(250%); }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            <div className="splash-container" style={{ position: 'absolute', width: '100%', height: '100%', zIndex: -1 }}></div>

            <div className="logo-container">
                <img
                    src={SwiftLogo}
                    alt="Swift Kasir"
                    className="logo-img"
                />
            </div>

            <div className="brand-text">SWIFT KASIR</div>

            <div className="loading-track">
                <div className="loading-bar"></div>
            </div>
        </div>
    );
};

export default SplashScreen;
