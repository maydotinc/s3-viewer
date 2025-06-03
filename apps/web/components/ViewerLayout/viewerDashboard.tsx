import ViewerBanner from "./viewerBanner";
import { ViewerSidebar } from "./viewerSidebar";

const ViewerDashboard = ( {children} : {children: React.ReactNode}) => {
    return (
        <ViewerBanner>
            <ViewerSidebar />
            {children}
        </ViewerBanner>
    )
}

export default ViewerDashboard;