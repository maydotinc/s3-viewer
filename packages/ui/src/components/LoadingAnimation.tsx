const LoadingAnimation = () => {
   return (
      <div className="flex h-[100dvh] items-center justify-center bg-white">
         <div className="flex flex-col items-center">
            <div className="logo-container">
               <img
                  src="/logo.svg"
                  alt="Viewer Logo"
                  draggable={false}
                  className="loading-logo"
                  style={{
                     userSelect: "none",
                     WebkitUserSelect: "none",
                     MozUserSelect: "none",
                     msUserSelect: "none",
                     pointerEvents: "none",
                  }}
               />
            </div>
            <div className="mt-12 flex space-x-3">
               <div className="loading-dot loading-dot-1"></div>
               <div className="loading-dot loading-dot-2"></div>
               <div className="loading-dot loading-dot-3"></div>
            </div>
         </div>
         <style>{`
            .logo-container {
               position: relative;
            }

            .logo-container::after {
               content: "";
               position: absolute;
               top: 50%;
               left: 50%;
               transform: translate(-50%, -50%);
               width: 160px;
               height: 160px;
               background: rgba(54, 88, 193, 0.1);
               border-radius: 50%;
               z-index: -1;
               animation: pulse 2s ease-in-out infinite;
            }

            .loading-logo {
               width: 100px;
               height: 100px;
               animation: float 3s ease-in-out infinite;
               filter: drop-shadow(0 10px 8px rgb(0 0 0 / 0.04));
               transition: all 0.3s ease;
            }

            @keyframes float {
               0% {
                  transform: translateY(0px) rotate(0deg);
               }
               50% {
                  transform: translateY(-15px) rotate(2deg);
               }
               100% {
                  transform: translateY(0px) rotate(0deg);
               }
            }

            @keyframes pulse {
               0% {
                  opacity: 0.4;
                  transform: translate(-50%, -50%) scale(0.95);
               }
               50% {
                  opacity: 0.6;
                  transform: translate(-50%, -50%) scale(1.05);
               }
               100% {
                  opacity: 0.4;
                  transform: translate(-50%, -50%) scale(0.95);
               }
            }

            .loading-dot {
               height: 12px;
               width: 12px;
               border-radius: 50%;
               background: linear-gradient(135deg, #3658C1, #4a6dd1);
               opacity: 0;
               animation: bounce 1.4s infinite;
               box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }

            .loading-dot-1 {
               animation-delay: 0s;l
            }

            .loading-dot-2 {
               animation-delay: 0.2s;
            }

            .loading-dot-3 {
               animation-delay: 0.4s;
            }

            @keyframes bounce {
               0%,
               100% {
                  opacity: 0.2;
                  transform: translateY(0);
               }
               50% {
                  opacity: 1;
                  transform: translateY(-10px);
               }
            }
         `}</style>
      </div>
   );
};

export default LoadingAnimation;
