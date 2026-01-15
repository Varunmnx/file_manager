import useApiQueryData from "@/hooks/customReactQueryHooks/useApiQueryData";
import { API } from "@/services";

export interface ProfileDetails {
    email: string,
    firstName: string,
    lastName: string,
    picture: string,
    provider: string,
    isActive: boolean,
    createdAt: string,
    updatedAt: string
}

export function useGetProfileDetails() {
    const getProfileDetailsMutation = useApiQueryData({
        queryFn: () => {
            return API.get<ProfileDetails>({
                slug: "/auth/profile"
            })
        },
        queryKey: ["getProfileDetails"]
    })
    return getProfileDetailsMutation
}