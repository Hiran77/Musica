import Error from "./Error";

const NotFound = () => {
  return (
    <Error 
      code="404" 
      title="Oops! Page not found"
      message="The page you're looking for doesn't exist."
    />
  );
};

export default NotFound;
