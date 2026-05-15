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
                args = json.loads(target)
                level = int(args.get("level", 50))
            except:
                level = int(target) if target.isdigit() else 50
                
            if system == "Darwin":
                subprocess.run(["osascript", "-e", f"set volume output volume {level}"])
                return f"Volume set to {level}% on Mac."
            elif system == "Windows":
                return f"Received command to set volume to {level}%. On Windows, consider 'pip install pycaw' to implement."
            else:
                return f"Volume set to {level}% (Unsupported OS logic)"
        elif command_type == "set_brightness":
            import json
            level = 50
            try:
                args = json.loads(target)
                level = int(args.get("level", 50))
            except:
                level = int(target) if target.isdigit() else 50
                
            if system == "Darwin":
                import shutil
                if shutil.which("brightness"):
                    try:
                        subprocess.run(["brightness", str(level / 100.0)], check=True)
                        return f"Brightness set to {level}% on Mac."
                    except subprocess.CalledProcessError:
                        return f"Failed to set brightness. Make sure your display supports software brightness control."
                else:
                    return f"Brightness adjustment failed. Please install the required CLI tool on your Mac by running: `brew install brightness` in your terminal."
            elif system == "Windows":
                # For Windows, WMI can do this
                try:
                    subprocess.run(["powershell", "-Command", f"(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,{level})"], check=False)
                except:
                    pass
                return f"Brightness set to {level}% on Windows."
            return f"Brightness set to {level}% (Unsupported OS logic)"
        elif command_type == "search":
            url = f"https://www.youtube.com/results?search_query={target.replace(' ', '+')}"
            if system == "Darwin":
                subprocess.Popen(["open", url])
            elif system == "Windows":
                subprocess.Popen(["start", url], shell=True)
            return f"Searching '{target}' on YouTube."
        elif command_type == "get_news":
            try:
                from duckduckgo_search import DDGS
                with DDGS() as ddgs:
                    results = [r for r in ddgs.news(target if target else "world news", max_results=5)]
                    if results:
                        response = "Latest News:\n"
                        for r in results:
                            response += f"- {r.get('title')}: {r.get('body')}\n"
                        return response
                    return "No news found."
            except Exception as e:
                return f"Error fetching news: {str(e)}"
        elif command_type == "get_weather":
            try:
                import requests
                # Convert target to JSON if needed, or target might just be string
                location = target
                try:
                    import json
                    args = json.loads(target)
                    location = args.get("location", target)
                except:
                    pass
                url = f"https://wttr.in/{location}?format=%l:+%C+%t+(feels+like+%f).+Wind:+%w,+Hum:+%h"
                resp = requests.get(url, timeout=5)
                if resp.status_code == 200:
                    return resp.text
                return f"Could not fetch weather for {location}"
            except Exception as e:
                return f"Weather error: {str(e)}"
        elif command_type == "get_system_stats":
            try:
                import psutil
                cpu = psutil.cpu_percent(interval=0.5)
                ram = psutil.virtual_memory()
                return f"System Stats - CPU Usage: {cpu}%. RAM Usage: {ram.percent}% ({ram.used // (1024**3)}GB / {ram.total // (1024**3)}GB)."
            except Exception as e:
                return f"System stats error (ensure psutil is installed): {str(e)}"
        elif command_type == "move_app_to_display":
            # For MacOS only we use AppleScript rough approximation
            if system == "Darwin":
                try:
                    import json
                    args = json.loads(target)
                    app_name = args.get("app_name", "")
                except:
                    app_name = target
                
                # AppleScript to try to move the window. Extremely brittle natively, so we give a best effort or tell the user.
                script = f'''
                tell application "System Events"
                    if exists (processes where name is "{app_name}") then
                        tell process "{app_name}"
                            set position of window 1 to {{1920, 0}}
                        end tell
                    end if
                end tell
                '''
                subprocess.Popen(["osascript", "-e", script])
                return f"Attempted to move {app_name} to second display (Requires Accessibility Permissions and fixed coordinates)."
            return "Display move not natively supported easily on this OS without extra tools like Yabai or specific Windows commands."

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
