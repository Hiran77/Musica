import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface ErrorPageProps {
  code?: string;
  title?: string;
  message?: string;
}

const Error = ({ 
  code = "Error", 
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again."
}: ErrorPageProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.error(`${code} Error: User encountered error at:`, location.pathname);
  }, [code, location.pathname]);

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center px-4">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
        <h1 className="mb-2 text-4xl font-bold text-foreground">{code}</h1>
        <p className="mb-2 text-xl text-foreground">{title}</p>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={handleGoBack} variant="outline">
            Go Back
          </Button>
          <Button onClick={() => navigate('/')}>
            Return to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Error;
