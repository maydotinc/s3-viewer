import ViewerBanner from "./Banner/banner";
import { ViewerSidebar } from "./sidebar";

const ViewerDashboard = ( {children} : {children: React.ReactNode}) => {
    return (
        <ViewerBanner>
            <div className="flex size-full">
                <ViewerSidebar />
                <div className="w-full md:w-[calc(100%-var(--sidebar-width))] h-full">
                    {children}
                </div>
            </div>
        </ViewerBanner>
    )
}

export default ViewerDashboard;