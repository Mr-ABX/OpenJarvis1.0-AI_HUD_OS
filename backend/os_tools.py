import sys
import platform
import subprocess

def execute_os_command(command_type: str, target: str):
    system = platform.system()
    try:
        if command_type == "open":
            if system == "Darwin":
                subprocess.Popen(["open", "-a", target])
                return f"Opening {target} on Mac."
            elif system == "Windows":
                subprocess.Popen(["start", target], shell=True)
                return f"Opening {target} on Windows."
            else:
                return f"Unsupported OS for opening {target}."
        elif command_type == "set_volume":
            import json
            level = 50
            try:
                # target will be a JSON string like {"level": 50}
                args = json.loads(target)
                level = int(args.get("level", 50))
            except:
                level = int(target) if target.isdigit() else 50
                
            if system == "Darwin":
                subprocess.Popen(["osascript", "-e", f"set volume output volume {level}"])
                return f"Volume set to {level}% on Mac."
            elif system == "Windows":
                # For basic Windows volume, you would normally use 'pycaw' or similar package.
                # Just mock or print here since it's an example:
                return f"Received command to set volume to {level}%. On Windows, consider 'pip install pycaw' to implement."
            else:
                return f"Volume set to {level}% (Unsupported OS logic)"
        elif command_type == "search":
            url = f"https://www.youtube.com/results?search_query={target.replace(' ', '+')}"
            if system == "Darwin":
                subprocess.Popen(["open", url])
            elif system == "Windows":
                subprocess.Popen(["start", url], shell=True)
            return f"Searching '{target}' on YouTube."
    except Exception as e:
        return f"Failed to execute command: {str(e)}"
    return "Command not recognized."

if __name__ == "__main__":
    if len(sys.argv) >= 3:
        cmd_type = sys.argv[1]
        target_name = " ".join(sys.argv[2:])
        print(execute_os_command(cmd_type, target_name))
    else:
        print("Invalid arguments. Usage: python os_tools.py <command> <target>")
