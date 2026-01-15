import { StorageKeys } from "@/utils";
import { isValidToken } from "@/utils/jwt";
import { useEffect } from "react";
import { useLocation } from "react-router-dom"

const GoogleLogin = () => {
  const params = useLocation()
  console.log(params)
  const queryParams = new URLSearchParams(params.search);

  const token = queryParams.get('token');
  
  
  useEffect(() => {
    if(token){
      const isValid = isValidToken(token)

      console.log("isValid",isValid)
      if(isValid){
        localStorage.setItem(StorageKeys.TOKEN,token)
        window.location.href = '/'
      }
    }
  },[token])
  return (
    <div>GoogleLogin</div>
  )
}

export default GoogleLogin